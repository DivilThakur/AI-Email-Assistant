import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import { LogOut, Send, RefreshCw, Mail, User, Bot, Sparkles, Trash2, Reply, X, Loader2, HelpCircle, Search, Layers, Moon, Sun } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [messages, setMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [recentEmails, setRecentEmails] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogin = () => {
    toast.loading("Redirecting to Google...", { duration: 2000 });
    window.location.href = `${API_BASE}/login`;
  };

  const handleLogout = async () => {
    try { await axios.get(`${API_BASE}/logout`, { withCredentials: true }); } catch (e) { }
    setIsLoggedIn(false); setMessages([]); setCurrentUser(""); setRecentEmails([]); toast.success("Logged out");
  };

  const addMessage = (role, content, type = 'text', data = null) => {
    setMessages(prev => [...prev, { role, content, type, data, id: Date.now() }]);
  };

  const handleCommand = async (command) => {
    if (!command.trim() || loading) return;

    addMessage('user', command);
    setInput("");
    const lowerCmd = command.toLowerCase();

    if (lowerCmd.includes("help") || lowerCmd.includes("commands") || lowerCmd.includes("guide")) {
      setShowHelp(true);
      setTimeout(() => addMessage('bot', "I've opened the command guide for you."), 500);
      return;
    }

    if (lowerCmd.includes("group") || lowerCmd.includes("categorize") || lowerCmd.includes("smart")) {
      await fetchCategorizedEmails();
      return;
    }

    if (lowerCmd.includes("delete") || lowerCmd.includes("trash") || lowerCmd.includes("remove")) {
      const numberMatch = lowerCmd.match(/(?:number|no\.?|#)\s*(\d+)/);
      if (numberMatch) {
        const index = parseInt(numberMatch[1]) - 1;
        if (recentEmails[index]) {
          handleDeleteClick(recentEmails[index].id, recentEmails[index].subject);
          return;
        } else {
          setTimeout(() => addMessage('bot', `I couldn't find email number ${numberMatch[1]}. Please check the list numbers.`), 500);
          return;
        }
      }

      if (lowerCmd.includes("from")) {
        const senderQuery = lowerCmd.split("from")[1].trim();
        const targetEmail = recentEmails.find(e => e.sender.toLowerCase().includes(senderQuery));
        if (targetEmail) {
          handleDeleteClick(targetEmail.id, targetEmail.subject);
          return;
        } else {
          setTimeout(() => addMessage('bot', `I couldn't find an email from "${senderQuery}" in your recent list.`), 500);
          return;
        }
      }

      if (lowerCmd.includes("about") || lowerCmd.includes("subject")) {
        const subjectQuery = lowerCmd.split(/about|subject/)[1].trim();
        const targetEmail = recentEmails.find(e => e.subject.toLowerCase().includes(subjectQuery));
        if (targetEmail) {
          handleDeleteClick(targetEmail.id, targetEmail.subject);
          return;
        }
      }

      setTimeout(() => addMessage('bot', "I'm not sure which email to delete. Try saying 'Delete email number 1'."), 500);
      return;
    }

    if (lowerCmd.includes("find") || lowerCmd.includes("search") || lowerCmd.includes("show")) {
      const keyword = lowerCmd.replace(/find|search|show|emails|email|from|about|for|me/g, "").trim();

      if (!keyword) {
        setTimeout(() => addMessage('bot', "What should I search for? Try 'Find emails from Google'."), 500);
        return;
      }

      const results = recentEmails.filter(email =>
        email.sender.toLowerCase().includes(keyword) ||
        email.subject.toLowerCase().includes(keyword) ||
        email.summary.toLowerCase().includes(keyword)
      );

      if (results.length > 0) {
        setTimeout(() => addMessage('bot', `I found ${results.length} emails matching "${keyword}":`, 'email-list', results), 500);
      } else {
        setTimeout(() => addMessage('bot', `I checked your recent emails but couldn't find anything matching "${keyword}".`), 500);
      }
      return;
    }

    if (lowerCmd.includes("read") || lowerCmd.includes("email") || lowerCmd.includes("refresh") || lowerCmd.includes("inbox") || lowerCmd.includes("check")) {
      await fetchEmails(false);
    } else {
      setLoading(true);
      setTimeout(() => {
        addMessage('bot', "I'm tuned to manage your inbox. Try 'Check Inbox', 'Find emails from Google', or 'Delete email number 1'.");
        setLoading(false);
      }, 1000);
    }
  };

  const fetchEmails = async (isAutoFetch = false) => {
    if (loading) return;
    if (!isAutoFetch) setLoading(true);

    try {
      const response = await axios.get(`${API_BASE}/read-emails`, { withCredentials: true });

      if (response.data.emails) {
        const userName = response.data.current_user || "User";
        setCurrentUser(userName);
        setIsLoggedIn(true);

        setRecentEmails(response.data.emails);

        if (messages.length === 0) {
          addMessage('bot', `Hi ${userName}! 👋 \n\nI'm your AI Email Assistant. I can help you **read your recent messages**, **search for specific topics**, **draft replies**, and **delete emails**.`);

          setTimeout(() => {
            if (response.data.emails.length > 0) {
              addMessage('bot', `I also checked your inbox and found ${response.data.emails.length} recent emails. Here is the summary:`, 'email-list', response.data.emails);
            } else {
              addMessage('bot', "I checked your inbox, but I didn't find any new emails right now.");
            }
          }, 800);
        } else if (!isAutoFetch) {
          if (response.data.emails.length > 0) {
            addMessage('bot', `Inbox refreshed. Here are your latest ${response.data.emails.length} emails:`, 'email-list', response.data.emails);
          } else {
            addMessage('bot', "No new emails found.");
          }
        }
      } else if (response.data.error === "not_authenticated") {
        setIsLoggedIn(false);
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
    setIsAppLoading(false);
  };

  const fetchCategorizedEmails = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/categorize-emails`, { withCredentials: true });

      if (response.data.groups) {
        addMessage('bot', "I've analyzed your last 20 emails and grouped them for you:", 'category-list', response.data.groups);
      } else {
        toast.error("AI could not categorize emails.");
      }
    } catch (error) { toast.error("Failed to categorize"); }
    setLoading(false);
  };

  const handleReplyClick = async (email) => {
    setReplyingTo(email);
    setDraft("Generating AI draft...");
    try {
      const response = await axios.post(`${API_BASE}/generate-reply`, {
        email_content: email.summary, sender: email.sender
      });
      setDraft(response.data.reply);
    } catch (error) { toast.error("Failed to generate draft"); setReplyingTo(null); }
  };

  const handleSendReply = async () => {
    setSending(true);
    try {
      await axios.post(`${API_BASE}/send-reply`, {
        recipient: replyingTo.sender, subject: "Re: " + replyingTo.subject, body: draft
      }, { withCredentials: true });
      toast.success("Email sent!");
      setReplyingTo(null);
      addMessage('bot', `✅ Reply sent to ${replyingTo.sender}`);
    } catch (error) { toast.error("Failed to send"); }
    setSending(false);
  };

  const handleDeleteClick = async (emailId, emailSubject = "this email") => {
    const isConfirmed = window.confirm(`Are you sure you want to delete the email: "${emailSubject}"?\n\nThis will move it to the Trash.`);

    if (!isConfirmed) {
      addMessage('bot', "Deletion cancelled. The email is safe.");
      return;
    }

    toast.loading("Deleting...", { id: "del" });
    try {
      await axios.post(`${API_BASE}/delete-email`, { email_id: emailId }, { withCredentials: true });

      toast.success("Deleted", { id: "del" });
      addMessage('bot', `🗑️ Email "${emailSubject}" moved to trash.`);

    } catch (error) { toast.error("Failed to delete", { id: "del" }); }
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("login_success") === "true") {
      toast.success("Successfully logged in!");
      window.history.replaceState({}, document.title, "/");
      fetchEmails(true);
    } else if (query.get("error")) {
      toast.error("Login Failed");
      setIsAppLoading(false);
    } else {
      fetchEmails(true);
    }
  }, []);

  if (isAppLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 space-y-4 animate-in fade-in duration-700">
        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center animate-bounce">
          <Sparkles className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
        </div>
        <p className="font-medium text-slate-500 dark:text-slate-400 animate-pulse">Connecting to your inbox...</p>
      </div>
    );
  }

  return (
    <div className={`flex h-screen font-sans overflow-hidden relative transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <Toaster position="top-center" />

      {showHelp && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className={`rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-indigo-50 border-gray-100'}`}>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className={`font-bold ${darkMode ? 'text-white' : 'text-indigo-900'}`}>Command Guide</h3>
              </div>
              <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div>
                <h4 className={`font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}><Mail className="w-4 h-4 text-indigo-500" /> Reading Emails</h4>
                <ul className={`text-sm space-y-1 p-3 rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                  <li>"Check Inbox"</li>
                  <li>"Read my emails"</li>
                  <li>"Refresh list"</li>
                </ul>
              </div>
              <div>
                <h4 className={`font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}><Search className="w-4 h-4 text-indigo-500" /> Search & Filter</h4>
                <ul className={`text-sm space-y-1 p-3 rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                  <li>"Find emails from <strong>Amazon</strong>"</li>
                  <li>"Show me emails about <strong>'Invoice'</strong>"</li>
                  <li>"Search for <strong>'Job Application'</strong>"</li>
                </ul>
              </div>
              <div>
                <h4 className={`font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}><Layers className="w-4 h-4 text-indigo-500" /> AI Organization</h4>
                <ul className={`text-sm space-y-1 p-3 rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                  <li>"Smart Group"</li>
                  <li>"Group my emails"</li>
                  <li className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">✨ Sorts emails into Work, Personal, etc.</li>
                </ul>
              </div>
              <div>
                <h4 className={`font-semibold mb-2 flex items-center gap-2 ${darkMode ? 'text-slate-200' : 'text-gray-800'}`}><Trash2 className="w-4 h-4 text-indigo-500" /> Actions</h4>
                <ul className={`text-sm space-y-1 p-3 rounded-lg border ${darkMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                  <li>"Delete email <strong>number 1</strong>"</li>
                  <li>"Delete email from <strong>LinkedIn</strong>"</li>
                  <li>"Delete email about <strong>Subscription</strong>"</li>
                  <li className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">💡 You can also use the <strong>Reply</strong> and <strong>Trash</strong> buttons on each card.</li>
                </ul>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-md cursor-pointer">Close Guide</button>
            </div>
          </div>
        </div>
      )}

      {replyingTo && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className={`rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden ${darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className={`p-4 border-b flex justify-between items-center ${darkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-100 bg-gray-50'}`}>
              <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-700'}`}>Drafting Reply</h3>
              <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <div className="mb-4 text-sm text-gray-500 dark:text-slate-400">To: <span className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>{replyingTo.sender}</span></div>
              <textarea
                className={`w-full h-40 p-4 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none leading-relaxed ${darkMode ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-gray-200 text-gray-700'}`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button onClick={() => setReplyingTo(null)} className={`px-4 py-2 font-medium rounded-lg transition-colors cursor-pointer ${darkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-600 hover:bg-gray-100'}`}>Cancel</button>
                <button onClick={handleSendReply} disabled={sending || draft.includes("Generating")} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Email</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className={`w-64 flex-col shadow-2xl z-10 hidden md:flex ${darkMode ? 'bg-slate-950 border-r border-slate-800' : 'bg-slate-900'} text-white`}>
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30"><Sparkles className="w-6 h-6 text-white" /></div><h1 className="font-bold text-xl tracking-tight">EmailAI</h1></div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {isLoggedIn && (
            <>
              <button
                onClick={() => handleCommand("Check my emails")}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer
                        ${loading ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 cursor-not-allowed opacity-70' : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'}`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                <span className="font-medium">{loading ? "Checking..." : "Check Inbox"}</span>
              </button>

              <button
                onClick={() => handleCommand("Smart Group")}
                disabled={loading}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer
                        ${loading ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 cursor-not-allowed opacity-70' : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent'}`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
                <span className="font-medium">{loading ? "Grouping..." : "Smart Group"}</span>
              </button>

              <button onClick={() => setShowHelp(true)} className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-transparent cursor-pointer">
                <HelpCircle className="w-5 h-5" /><span className="font-medium">Commands</span>
              </button>
            </>
          )}
        </nav>

        <div className="px-4 py-2">
          <button onClick={() => setDarkMode(!darkMode)} className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 transition-all cursor-pointer">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />} {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {isLoggedIn && (
          <div className="p-4 border-t border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-3 mb-3"><div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-sm font-bold">{currentUser ? currentUser[0].toUpperCase() : <User className="w-5 h-5" />}</div><div className="overflow-hidden"><p className="text-sm font-medium truncate">{currentUser || "User"}</p><p className="text-xs text-slate-400">Online</p></div></div>
            <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-slate-400 hover:text-red-400 transition-colors w-full cursor-pointer"><LogOut className="w-4 h-4" /> Sign Out</button>
          </div>
        )}
      </aside>

      <main className={`flex-1 flex flex-col relative ${darkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
          {!isLoggedIn ? (
            <div className="h-full flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/30"><Mail className="w-10 h-10 text-white" /></div>
              <h2 className={`text-4xl font-extrabold mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>Your Intelligent Inbox</h2>
              <p className={`max-w-md mb-8 text-lg ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Connect your Google account to let AI summarize, prioritize, and draft responses for you.</p>
              <button onClick={handleLogin} className="px-8 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:scale-105 transition-transform flex items-center gap-3 cursor-pointer">Sign in with Google</button>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                  {msg.role === 'bot' && <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 mt-1 shrink-0"><Bot className="w-5 h-5 text-indigo-600" /></div>}
                  <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : (darkMode ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white border border-gray-100 text-slate-800') + ' rounded-bl-none'}`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {msg.type === 'email-list' && (
                      <div className="mt-4 space-y-3">
                        {msg.data.map((email, idx) => (
                          <div key={email.id} className={`p-4 rounded-xl border transition-colors ${darkMode ? 'bg-slate-900 border-slate-700 hover:border-indigo-500' : 'bg-slate-50 border-gray-200 hover:border-indigo-200'}`}>
                            <div className="flex justify-between items-start mb-2"><h4 className={`font-bold text-sm truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{email.subject}</h4><span className="text-xs opacity-50">#{idx + 1}</span></div>
                            <p className="text-xs opacity-70 mb-2">{email.sender}</p>
                            <p className={`text-sm p-2 rounded ${darkMode ? 'bg-indigo-900/30 text-indigo-200' : 'bg-indigo-50 text-indigo-800'}`}>{email.summary}</p>
                            <div className={`flex gap-2 mt-2 pt-2 border-t ${darkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                              <button onClick={() => handleReplyClick(email)} className="text-xs flex items-center gap-1 hover:text-indigo-500 cursor-pointer p-1 transition-colors"><Reply className="w-3 h-3" /> Reply</button>
                              <button onClick={() => handleDeleteClick(email.id, email.subject)} className="text-xs flex items-center gap-1 hover:text-red-500 cursor-pointer p-1 transition-colors"><Trash2 className="w-3 h-3" /> Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.type === 'category-list' && (
                      <div className="mt-4 space-y-6">
                        {msg.data.map((group, idx) => (
                          <div key={idx} className="border-l-4 border-indigo-500 pl-4">
                            <h3 className={`font-bold text-lg ${darkMode ? 'text-indigo-400' : 'text-indigo-900'}`}>{group.category}</h3>
                            <p className="text-sm opacity-60 italic mb-2">{group.summary}</p>
                            <div className="space-y-2">
                              {group.emails.map(email => (
                                <div key={email.id} className={`border p-3 rounded-lg shadow-sm text-sm flex justify-between items-start hover:shadow-md transition-shadow ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'}`}>
                                  <div className="flex-1 min-w-0 pr-3">
                                    <span className={`font-semibold block truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>{email.subject}</span>
                                    <span className="text-xs opacity-50 block">{email.sender}</span>
                                    {email.summary && <span className="text-xs text-indigo-500 mt-1 block">{email.summary}</span>}
                                  </div>
                                  <div className="flex gap-2 shrink-0">
                                    <button onClick={() => handleReplyClick(email)} className="opacity-50 hover:opacity-100 hover:text-indigo-600 p-1 cursor-pointer"><Reply className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteClick(email.id, email.subject)} className="opacity-50 hover:opacity-100 hover:text-red-500 p-1 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && <div className="flex items-center gap-2 opacity-50 ml-12"><Loader2 className="w-4 h-4 animate-spin" /> AI thinking...</div>}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {isLoggedIn && (
          <div className={`p-4 border-t ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-100'}`}>
            <div className="max-w-4xl mx-auto relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCommand(input)}
                placeholder="Type a command (e.g., 'Read my emails')..."
                disabled={loading}
                className={`w-full pl-6 pr-14 py-4 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${darkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder-gray-400'}`}
              />
              <button onClick={() => handleCommand(input)} disabled={!input.trim() || loading} className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center transition-all cursor-pointer">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-center text-xs opacity-50 mt-2">AI can make mistakes. Please check important info.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;