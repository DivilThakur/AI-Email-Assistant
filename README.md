## 📧 AI Email Assistant

A smart, AI-powered email dashboard that helps you manage your Gmail inbox using natural language.  
Built with **FastAPI**, **React**, and **Google Gemini**.

---

## 🚀 Live Demo

**Frontend (Vercel):** https://ai-email-assistant-liart.vercel.app/  
> ⚠️ *You must log in with a Google Test Account to access the demo.*

---

## ✨ Features

### 🧠 Core AI Features
- **Smart Summarization**  
  Reads your last 5 emails and generates concise, actionable summaries.

- **Context-Aware Replies**  
  Automatically drafts professional email responses based on the full conversation context.

- **Natural Language Commands**  
  Control the app simply by typing:
  - “Find emails from Amazon”
  - “Delete the email about the meeting”
  - “Reply to John saying I'll be there”

- **Smart Grouping (Bonus)**  
  Fetches 20 emails and intelligently categorizes them into:
  **Work**, **Personal**, **Promotions**, and **Urgent**.

---

### 🎨 UI/UX Features
- **Modern Chat Interface**  
  Clean ChatGPT-style layout with glassmorphism design.

- **Dark Mode**  
  Full system-level dark theme support.

- **Optimized Performance**  
  Batch AI processing avoids API rate limits.

- **Secure Auth**  
  Fully integrated Google OAuth2 with secure session handling.

---

## 🛠️ Tech Stack

| Component | Technology | Purpose |
|----------|------------|---------|
| **Backend** | Python (FastAPI) | API Logic, OAuth, Gmail Integration |
| **Frontend** | React (Vite) | UI Rendering & State Management |
| **AI Model** | Google Gemini Flash | Summarization & Intent Understanding |
| **Styling** | Tailwind CSS | Responsive Design + Dark Mode |
| **Animations** | Framer Motion | Smooth UI transitions |
| **Session Storage** | In-Memory + HttpOnly Cookies | Secure Authentication Sessions |


## ⚙️ Installation & Setup

### **1. Prerequisites**
- Python **3.10+**
- Node.js & npm
- A Google Cloud Project with **Gmail API enabled**

---

### **2. Clone the Repository**
## backend setup
```bash
git clone https://github.com/your-username/ai-email-assistant.git
cd ai-email-assistant
cd backend

# Create virtual environment (optional but recommended)
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the backend server
uvicorn main:app --reload
```
## frontend setup
```bash
cd frontend
npm install
npm run dev
```
---

## 🔑 Configuration (Environment Variables)

You need to set up environment variables for both the backend and frontend.


### **Backend Environment Variables (`backend/.env`)**


```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GEMINI_API_KEY=your_gemini_api_key

# Local Development
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# Production (Render / Vercel)
BACKEND_URL=https://your-backend.onrender.com
FRONTEND_URL=https://your-frontend.vercel.app
```
### **Frontend Environment Variables (`frontend/.env`)**

```env
VITE_API_URL=https://your-backend.onrender.com
```

## 📘 Google OAuth Setup Guide

Follow these steps to configure Google OAuth:

1. Go to **Google Cloud Console → APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (Web Application)
3. Add the following **Authorized Redirect URIs**:

    **Local Development**
http://localhost:8000/auth/callback
    **Production**
https://your-backend.onrender.com/auth/callback
4. Enable the **Gmail API** in the Library section
5. Add your email to **Test Users** under the OAuth Consent Screen

---

## 🧪 How to Test

### **1. Basic Flow**
- Click **"Sign in with Google"**
- Grant permissions (Read, Send, Delete)
- Click **"Check Inbox"** to generate AI summaries

### **2. AI Actions**
- **Reply:**  
Click **Reply** → AI drafts message → Click **Send** to dispatch via Gmail  
- **Delete:**  
Click **Trash** → Confirm popup → Email moves to Trash

### **3. Natural Language Commands (Bonus)**
Try typing commands like:
- “Show me emails from LinkedIn”
- “Group my emails”
- “Delete email number 1”

---

## ⚠️ Assumptions & Limitations

- **Rate Limiting:**  
Gemini Free Tier (15 RPM) → app uses `time.sleep(1.0)` between requests
- **Test Mode:**  
Only **whitelisted Test Users** can sign in unless app is fully verified by Google
- **Session Storage:**  
Sessions stored in **signed cookies** (Redis recommended for production)

---

## 🏆 Evaluation Checklist

- [x] Functionality: Read, Reply, Delete emails via Gmail API  
- [x] Auth: Secure Google OAuth2 login + session handling
- [x] AI Integration: Uses Gemini for summarizing and drafting.
- [x] UX: Clean Dashboard with Dark Mode and Animations.
- [x] Bonus: Smart Grouping & Natural Language Commands implemented.
