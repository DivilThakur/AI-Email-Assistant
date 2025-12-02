import os
import time
import json
import base64
from email.mime.text import MIMEText

import google.generativeai as genai
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from starlette.config import Config
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from authlib.integrations.starlette_client import OAuth
from pydantic import BaseModel

load_dotenv()
GOOGLE_API_KEY = os.getenv("GEMINI_API_KEY")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

genai.configure(api_key=GOOGLE_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash-lite')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5172"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    SessionMiddleware,
    secret_key="super_secret_random_string",
    https_only=False,
    same_site='lax'
)

config_data = {
    'GOOGLE_CLIENT_ID': GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': GOOGLE_CLIENT_SECRET
}
starlette_config = Config(environ=config_data)
oauth = OAuth(starlette_config)

oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify',
        'timeout': 30.0
    },
)

class InterpretRequest(BaseModel):
    command: str

class ReplyRequest(BaseModel):
    email_content: str
    sender: str
    instruction: str = None

class SendRequest(BaseModel):
    recipient: str
    subject: str
    body: str

class DeleteRequest(BaseModel):
    email_id: str

@app.get("/")
def home():
    return {"status": "Backend is running"}

@app.get("/login")
async def login(request: Request):
    redirect_uri = 'http://localhost:8000/auth/callback'
    return await oauth.google.authorize_redirect(request, redirect_uri, prompt='consent')

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return {"message": "logged_out"}

@app.get("/auth/callback")
async def auth_callback(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        request.session['user'] = token
        return RedirectResponse(url='http://localhost:5173?login_success=true')
    except Exception as e:
        print(f"Login Error: {e}")
        return RedirectResponse(url='http://localhost:5173?error=login_failed')

@app.get("/read-emails")
async def read_emails(request: Request):
    user = request.session.get('user')
    if not user:
        return {"error": "not_authenticated"}

    access_token = user.get('access_token')

    async with httpx.AsyncClient() as client:
        headers = {'Authorization': f'Bearer {access_token}'}
        try:
            profile_response = await client.get('https://www.googleapis.com/oauth2/v1/userinfo', headers=headers, timeout=30.0)
            if profile_response.status_code == 401:
                request.session.clear()
                return {"error": "session_expired"}
            profile_data = profile_response.json()
            user_name = profile_data.get('given_name') or profile_data.get('email')
        except:
            user_name = "User"

        try:
            response = await client.get(
                'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5&labelIds=INBOX',
                headers=headers, timeout=30.0
            )
        except httpx.ConnectTimeout:
            return {"error": "timeout"}

        messages_data = response.json()
        if 'messages' not in messages_data:
            return {"emails": [], "current_user": user_name}

        email_data_list = []
        for msg in messages_data['messages']:
            msg_id = msg['id']
            msg_detail = await client.get(f'https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}', headers=headers, timeout=30.0)
            email_data = msg_detail.json()

            snippet = email_data.get('snippet', 'No content')
            headers_list = email_data['payload']['headers']
            subject = next((h['value'] for h in headers_list if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers_list if h['name'] == 'From'), 'Unknown')

            email_data_list.append({
                "id": msg_id,
                "sender": sender,
                "subject": subject,
                "snippet": snippet,
                "summary": "Loading..."
            })

        try:
            snippets_text = "\n".join([f"Email {i+1}: {e['snippet']}" for i, e in enumerate(email_data_list)])
            prompt = f"""
            You are a helpful executive assistant. Summarize these {len(email_data_list)} emails.
            For each email, write a 1-sentence summary (max 15 words).
            
            Return a strictly valid JSON array of strings, like this:
            ["Summary for email 1", "Summary for email 2", "Summary for email 3", ...]
            
            Emails to summarize:
            {snippets_text}
            """
            ai_response = model.generate_content(prompt)
            clean_json = ai_response.text.replace("```json", "").replace("```", "").strip()
            summaries = json.loads(clean_json)

            for i, email in enumerate(email_data_list):
                if i < len(summaries):
                    email['summary'] = summaries[i]
                else:
                    email['summary'] = "Could not generate summary."

        except Exception as e:
            print(f"Batch AI Error: {e}")
            for email in email_data_list:
                email['summary'] = "AI Unavailable (Rate Limit)"

        return {"emails": email_data_list, "current_user": user_name}

@app.post("/interpret-command")
async def interpret_command(req: InterpretRequest):
    prompt = f"""
    You are an API router. Map the user command to a JSON object.
    
    Commands & Output Format:
    1. Read/Check Emails -> {{"action": "read"}}
    2. Smart Group/Categorize -> {{"action": "group"}}
    3. Search/Find (e.g. "Find emails from Amazon") -> {{"action": "search", "query": "Amazon"}}
    4. Delete (e.g. "Delete email from John") -> {{"action": "delete", "query": "John"}}
    5. Reply (e.g. "Reply to Mike that I'll be late") -> {{"action": "reply", "query": "Mike", "content": "I'll be late"}}
    
    If unsure, return {{"action": "unknown"}}.
    USER INPUT: "{req.command}"
    Return ONLY JSON.
    """
    try:
        res = model.generate_content(prompt)
        clean = res.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except:
        return {"action": "unknown"}

@app.post("/generate-reply")
async def generate_reply(req: ReplyRequest):
    context = f"Additional User Instruction: {req.instruction}" if req.instruction else "Keep it polite and concise."
    prompt = f"""
    Write a professional email reply to {req.sender}.
    Context from Original Email: "{req.email_content}"
    {context}
    Keep it under 50 words.
    """
    try:
        res = model.generate_content(prompt)
        return {"reply": res.text.strip()}
    except Exception as e:
        return {"error": str(e)}

@app.post("/send-reply")
async def send_reply(req: SendRequest, request: Request):
    user = request.session.get('user')
    if not user:
        return {"error": "not_authenticated"}

    access_token = user.get('access_token')

    async with httpx.AsyncClient() as client:
        message = MIMEText(req.body)
        message['to'] = req.recipient
        message['subject'] = req.subject
        raw_string = base64.urlsafe_b64encode(message.as_bytes()).decode()

        headers = {'Authorization': f'Bearer {access_token}'}
        response = await client.post(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            headers=headers,
            json={'raw': raw_string}
        )
        return {"status": "sent"} if response.status_code == 200 else {"error": "failed"}

@app.post("/delete-email")
async def delete_email(req: DeleteRequest, request: Request):
    user = request.session.get('user')
    if not user:
        return {"error": "not_authenticated"}

    access_token = user.get('access_token')

    async with httpx.AsyncClient() as client:
        headers = {'Authorization': f'Bearer {access_token}'}
        response = await client.post(
            f'https://gmail.googleapis.com/gmail/v1/users/me/messages/{req.email_id}/trash',
            headers=headers
        )
        return {"status": "deleted"} if response.status_code == 200 else {"error": "failed"}

@app.get("/categorize-emails")
async def categorize_emails(request: Request):
    user = request.session.get('user')
    if not user:
        return {"error": "not_authenticated"}

    access_token = user.get('access_token')

    async with httpx.AsyncClient() as client:
        headers = {'Authorization': f'Bearer {access_token}'}

        try:
            response = await client.get(
                'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&labelIds=INBOX',
                headers=headers, timeout=30.0
            )
        except:
            return {"error": "timeout"}

        messages_data = response.json()
        if 'messages' not in messages_data:
            return {"groups": []}

        email_txt = []
        for msg in messages_data['messages']:
            msg_id = msg['id']
            detail = await client.get(f'https://gmail.googleapis.com/gmail/v1/users/me/messages/{msg_id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Snippet', headers=headers)
            info = detail.json()

            headers_list = info.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers_list if h['name'] == 'Subject'), 'No Subject')
            sender = next((h['value'] for h in headers_list if h['name'] == 'From'), 'Unknown')
            snippet = info.get('snippet', '')

            email_txt.append(f"ID: {msg_id} | From: {sender} | Subject: {subject} | Snippet: {snippet}")

        prompt = f"""
        Analyze these emails. Group them into: 'Urgent', 'Work', 'Personal', 'Promotions'.
        Return strictly a JSON object with this structure:
        [
            {{
                "category": "Category Name",
                "summary": "1-sentence summary of group",
                "emails": [
                    {{
                        "id": "id",
                        "subject": "subj",
                        "sender": "sender",
                        "summary": "short summary of this email"
                    }}
                ]
            }}
        ]
        Only return categories that have emails.
        EMAILS: {"\n".join(email_txt)}
        """

        try:
            ai_response = model.generate_content(prompt)
            clean_json = ai_response.text.replace("```json", "").replace("```", "").strip()
            grouped_data = json.loads(clean_json)
            return {"groups": grouped_data}
        except Exception as e:
            print(f"AI Grouping Error: {e}")
            return {"error": "ai_error"}