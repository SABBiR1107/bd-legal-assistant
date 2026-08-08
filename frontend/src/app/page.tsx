"use client";

import { useState, useEffect, useRef } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { 
  Scale, 
  Send, 
  Bot, 
  User, 
  FileText, 
  Plus, 
  History, 
  ShieldAlert, 
  UploadCloud, 
  LayoutDashboard,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Sparkles,
  Search,
  MessageSquare,
  Loader2
} from "lucide-react";

interface Citation {
  source: string;
  page: number;
  content: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

export default function Home() {
  const { user, isLoaded } = useUser();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested prompts
  const samplePrompts = [
    { text: "What is the process of land registration under Bangladesh law?", category: "Property Law" },
    { text: "Explain the grounds for divorce in Bangladesh under Christian Marriage Act.", category: "Family Law" },
    { text: "What are the rules regarding maternity benefits under Bangladesh Labour Act 2006?", category: "Labour Law" },
    { text: "What is the punishment for online defamation under Cyber Security Act 2023?", category: "Cyber Law" }
  ];

  useEffect(() => {
    // Load local conversations or seed one
    const localConvs = localStorage.getItem("bd_legal_assistant_convs");
    if (localConvs) {
      try {
        const parsed = JSON.parse(localConvs);
        setConversations(parsed);
        if (parsed.length > 0) {
          setActiveConvId(parsed[0].id);
          setMessages(parsed[0].messages);
        }
      } catch (e) {
        console.error("Failed to parse conversations", e);
      }
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const saveConversations = (updated: Conversation[]) => {
    setConversations(updated);
    localStorage.setItem("bd_legal_assistant_convs", JSON.stringify(updated));
  };

  const handleStartNewChat = () => {
    const newConv: Conversation = {
      id: Math.random().toString(36).substring(7),
      title: `Legal Consultation ${conversations.length + 1}`,
      messages: []
    };
    const updated = [newConv, ...conversations];
    saveConversations(updated);
    setActiveConvId(newConv.id);
    setMessages([]);
    setSelectedCitation(null);
  };

  const handleSelectConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setActiveConvId(id);
      setMessages(conv.messages);
      setSelectedCitation(null);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const msgText = textToSend || input;
    if (!msgText.trim()) return;

    setInput("");
    setIsLoading(true);

    const userMsg: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: msgText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Update active conversation in list
    let currentConvId = activeConvId;
    let currentConvs = [...conversations];

    if (!currentConvId) {
      currentConvId = Math.random().toString(36).substring(7);
      const newConv: Conversation = {
        id: currentConvId,
        title: msgText.slice(0, 30) + (msgText.length > 30 ? "..." : ""),
        messages: [userMsg]
      };
      currentConvs = [newConv, ...currentConvs];
      setActiveConvId(currentConvId);
    } else {
      currentConvs = currentConvs.map(c => {
        if (c.id === currentConvId) {
          const title = c.messages.length === 0 ? msgText.slice(0, 30) + (msgText.length > 30 ? "..." : "") : c.title;
          return { ...c, title, messages: [...c.messages, userMsg] };
        }
        return c;
      });
    }
    saveConversations(currentConvs);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msgText,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) throw new Error("Backend failed to respond");

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: data.answer,
        citations: data.citations || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);

      const savedConvs = currentConvs.map(c => {
        if (c.id === currentConvId) {
          return { ...c, messages: finalMessages };
        }
        return c;
      });
      saveConversations(savedConvs);

    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: Math.random().toString(36).substring(7),
        role: "assistant",
        content: "Error: Unable to connect to Bangladesh Legal AI core services. Please make sure the backend is running.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([...updatedMessages, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-80 shrink-0 border-r border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-col">
        {/* Brand */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight flex items-center gap-1.5">
              BD Legal <span className="text-emerald-400 text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">AI</span>
            </h1>
            <p className="text-xs text-slate-400">Bangladesh Legal Companion</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4">
          <button 
            onClick={handleStartNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 duration-300"
          >
            <Plus className="h-5 w-5" />
            New Consultation
          </button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <div className="px-3 mb-2 flex items-center justify-between text-xs text-slate-400 font-semibold tracking-wider uppercase">
            <span className="flex items-center gap-1"><History className="h-3.5 w-3.5" /> Recent Sessions</span>
            <span>{conversations.length}</span>
          </div>

          {conversations.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-500">
              No sessions yet.
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectConversation(c.id)}
                className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors duration-150 ${
                  activeConvId === c.id 
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300" 
                    : "hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm font-medium">{c.title}</span>
              </button>
            ))
          )}
        </div>

        {/* Bottom Panel */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex flex-col gap-2">
          <Link 
            href="/admin"
            className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-sm border border-slate-800/50"
          >
            <span className="flex items-center gap-2 font-medium">
              <LayoutDashboard className="h-4 w-4 text-emerald-400" />
              Document Admin
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800/50">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <div className="text-left">
                <p className="text-xs font-semibold truncate max-w-[120px]">
                  {user?.fullName || user?.username || "Legal Scholar"}
                </p>
                <p className="text-[10px] text-emerald-400">Authenticated</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col bg-slate-950 relative">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full -z-10 pointer-events-none" />

        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-emerald-500 md:hidden" />
            <h2 className="font-semibold text-sm tracking-wide text-slate-300 uppercase flex items-center gap-1.5">
              Interactive Legal AI Sandbox
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Gemini 2.5 Flash Pipeline
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Chat Panel */}
          <div className="flex-1 flex flex-col h-full">
            {messages.length === 0 ? (
              // Welcome Panel
              <div className="flex-1 overflow-y-auto px-8 py-12 flex flex-col justify-center items-center max-w-3xl mx-auto text-center">
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 mb-6 animate-bounce">
                  <Scale className="h-10 w-10" />
                </div>
                <h3 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
                  Legal Assistant for <span className="text-emerald-400 bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">Bangladesh Laws</span>
                </h3>
                <p className="mt-4 text-slate-400 max-w-xl text-base leading-relaxed">
                  Ask queries on the Constitution of Bangladesh, Penal Code, Labour Act, Land regulations, and custom uploaded PDF archives.
                </p>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {samplePrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(p.text)}
                      className="text-left p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-emerald-500/30 transition-all duration-300 flex flex-col gap-1.5 group"
                    >
                      <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">{p.category}</span>
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors flex items-center gap-1">
                        {p.text}
                        <ArrowRight className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Active Conversation Screen
              <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    
                    <div className={`max-w-2xl rounded-2xl p-4 ${
                      m.role === 'user'
                        ? 'bg-emerald-500 text-slate-950 font-medium'
                        : 'bg-slate-900 border border-slate-800'
                    }`}>
                      <div className="text-sm leading-relaxed whitespace-pre-line">
                        {m.content}
                      </div>
                      
                      {/* Citations list for assistant response */}
                      {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap gap-2 items-center">
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> Citations:
                          </span>
                          {m.citations.map((cite, idx) => (
                            <button
                              key={idx}
                              onClick={() => setSelectedCitation(cite)}
                              className="text-[11px] bg-slate-800 border border-slate-700 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 font-semibold px-2 py-0.5 rounded transition-all flex items-center gap-1"
                            >
                              {cite.source.split('/').pop()} (Page {cite.page})
                            </button>
                          ))}
                        </div>
                      )}

                      <div className={`text-[10px] mt-1 text-right ${m.role === 'user' ? 'text-slate-900/60' : 'text-slate-500'}`}>
                        {m.timestamp}
                      </div>
                    </div>

                    {m.role === 'user' && (
                      <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 shrink-0 border border-slate-700">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-4 justify-start">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-sm text-slate-400">Consulting legal statutes & constitution...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input Panel */}
            <div className="p-6 border-t border-slate-800/60 bg-slate-950">
              <div className="max-w-4xl mx-auto flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-2 focus-within:border-emerald-500/40 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="Ask any legal question (e.g. Constitutional rights, cyber crime penalties...)"
                  className="flex-1 bg-transparent border-0 outline-none text-sm px-3 text-slate-100 placeholder:text-slate-500 focus:ring-0"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !input.trim()}
                  className="p-3 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:hover:bg-emerald-500 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[11px] text-center text-slate-500 mt-2.5">
                Disclaimer: AI responses are generated via RAG pipelines over statutes. Verify with licensed legal counsels for litigation.
              </p>
            </div>
          </div>

          {/* Citation Sidebar Panel */}
          {selectedCitation && (
            <div className="w-96 border-l border-slate-800 bg-slate-900/40 backdrop-blur-md flex flex-col animate-slide-in">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-400" />
                  Citation Inspector
                </h3>
                <button 
                  onClick={() => setSelectedCitation(null)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-850">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Source Document</p>
                  <p className="text-sm font-semibold text-white mt-1 break-all">{selectedCitation.source.split('/').pop()}</p>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-850 flex justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Page Number</p>
                    <p className="text-sm font-semibold text-white mt-1">{selectedCitation.page}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Confidence Match</p>
                    <p className="text-sm font-semibold text-emerald-400 mt-1">High (FAISS Index)</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Retrieved Text Segment</p>
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-sm leading-relaxed text-slate-200 whitespace-pre-line italic">
                    "{selectedCitation.content}"
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
