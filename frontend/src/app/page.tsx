"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Scale, Send, Bot, User, FileText, Plus, History,
  UploadCloud, LayoutDashboard, BookOpen, ArrowRight,
  MessageSquare, Loader2, Download, Trash2, Sparkles, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Citation {
  source: string;
  page: number;
  content: string;
  confidence?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  timestamp: string;
  isStreaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getConfidenceStyle = (confidence?: number) => {
  if (!confidence) return { text: "text-slate-400", bar: "bg-slate-600", label: "N/A" };
  if (confidence >= 80) return { text: "text-emerald-400", bar: "bg-emerald-500", label: `${confidence}%` };
  if (confidence >= 60) return { text: "text-amber-400", bar: "bg-amber-500", label: `${confidence}%` };
  return { text: "text-rose-400", bar: "bg-rose-500", label: `${confidence}%` };
};

const genId = () => Math.random().toString(36).substring(2, 9);

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getApiBase = () => {
    let url = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim().replace(/\/+$/, "");
    if (url.endsWith("/api")) {
      url = url.slice(0, -4);
    }
    return url;
  };
  const API_BASE = getApiBase();

  const samplePrompts = [
    { text: "What is the process of land registration under Bangladesh law?", category: "Property Law" },
    { text: "Explain the grounds for divorce under Muslim Family Laws Ordinance.", category: "Family Law" },
    { text: "What are the maternity benefits under Bangladesh Labour Act 2006?", category: "Labour Law" },
    { text: "What is the punishment for online defamation under Cyber Security Act 2023?", category: "Cyber Law" },
  ];

  // ── Load conversations from localStorage ──────────────────────────────────
  useEffect(() => {
    const local = localStorage.getItem("bd_legal_assistant_convs");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        setConversations(parsed);
        if (parsed.length > 0) {
          setActiveConvId(parsed[0].id);
          setMessages(parsed[0].messages);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const saveConversations = useCallback((updated: Conversation[]) => {
    setConversations(updated);
    localStorage.setItem("bd_legal_assistant_convs", JSON.stringify(updated));
  }, []);

  // ── New chat ──────────────────────────────────────────────────────────────
  const handleStartNewChat = () => {
    const newConv: Conversation = { id: genId(), title: "New Consultation", messages: [] };
    const updated = [newConv, ...conversations];
    saveConversations(updated);
    setActiveConvId(newConv.id);
    setMessages([]);
    setSelectedCitation(null);
  };

  // ── Select conversation ───────────────────────────────────────────────────
  const handleSelectConversation = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (conv) { setActiveConvId(id); setMessages(conv.messages); setSelectedCitation(null); }
  };

  // ── Delete conversation ───────────────────────────────────────────────────
  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = conversations.filter((c) => c.id !== id);
    saveConversations(updated);
    if (activeConvId === id) {
      if (updated.length > 0) { setActiveConvId(updated[0].id); setMessages(updated[0].messages); }
      else { setActiveConvId(null); setMessages([]); }
    }
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    if (messages.length === 0) return;
    const conv = conversations.find((c) => c.id === activeConvId);
    const title = conv?.title || "Legal Consultation";
    const pw = window.open("", "_blank");
    if (!pw) return;

    const content = messages.map((m) => `
      <div style="margin:16px 0;padding:16px;border-radius:8px;${
        m.role === "user"
          ? "background:#d1fae5;text-align:right;"
          : "background:#f3f4f6;border-left:4px solid #059669;"
      }">
        <div style="font-weight:700;margin-bottom:8px;color:${m.role === "user" ? "#065f46" : "#1f2937"};">
          ${m.role === "user" ? "👤 You" : "⚖️ BD Legal AI"}
          <span style="font-weight:400;font-size:12px;color:#6b7280;margin-left:8px;">${m.timestamp}</span>
        </div>
        <div style="white-space:pre-wrap;line-height:1.7;">${m.content.replace(/</g,"&lt;")}</div>
        ${m.citations && m.citations.length > 0 ? `
          <div style="margin-top:12px;padding-top:8px;border-top:1px solid #d1d5db;font-size:12px;color:#6b7280;">
            📚 <strong>Sources:</strong>
            ${m.citations.map((c) => `${c.source.split("/").pop()} (Page ${c.page})${c.confidence ? ` · ${c.confidence}%` : ""}`).join(" | ")}
          </div>` : ""}
      </div>`).join("");

    pw.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>BD Legal AI – ${title}</title>
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1f2937}
        .hdr{border-bottom:3px solid #059669;padding-bottom:20px;margin-bottom:30px}
        .hdr h1{color:#059669;margin:0;font-size:22px}
        .hdr p{color:#6b7280;margin:6px 0 0;font-size:13px}
        .footer{margin-top:40px;padding-top:16px;border-top:1px solid #d1d5db;font-size:12px;color:#9ca3af;text-align:center}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>
      <div class="hdr"><h1>⚖️ Bangladesh AI Legal Assistant</h1>
      <p>${title} &nbsp;·&nbsp; Exported: ${new Date().toLocaleString()}</p></div>
      ${content}
      <div class="footer">Disclaimer: AI responses are generated via RAG pipeline over Bangladesh statutes. Verify with licensed legal counsel for litigation.</div>
    </body></html>`);
    pw.document.close();
    setTimeout(() => pw.print(), 400);
  };

  // ── Send message (Streaming) ──────────────────────────────────────────────
  const handleSendMessage = async (textToSend?: string) => {
    const msgText = textToSend || input;
    if (!msgText.trim() || isLoading) return;

    setInput("");
    setIsLoading(true);
    setSelectedCitation(null);

    const userMsg: Message = {
      id: genId(), role: "user", content: msgText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // ── Manage conversation in localStorage ──────────────────────────────
    let convId = activeConvId;
    let convList = [...conversations];

    if (!convId) {
      convId = genId();
      const newConv: Conversation = { id: convId, title: msgText.slice(0, 35) + (msgText.length > 35 ? "…" : ""), messages: [userMsg] };
      convList = [newConv, ...convList];
      setActiveConvId(convId);
    } else {
      convList = convList.map((c) => {
        if (c.id !== convId) return c;
        const title = c.messages.length === 0 ? msgText.slice(0, 35) + (msgText.length > 35 ? "…" : "") : c.title;
        return { ...c, title, messages: [...c.messages, userMsg] };
      });
    }
    saveConversations(convList);

    // ── Streaming placeholder message ─────────────────────────────────────
    const asstId = genId();
    const placeholder: Message = {
      id: asstId, role: "assistant", content: "", citations: [],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isStreaming: true,
    };
    setMessages([...updatedMessages, placeholder]);

    try {
      const resp = await fetch(`${API_BASE}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msgText,
          conversation_id: convId,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error(`Backend error: ${resp.status}`);

      setIsLoading(false);
      setStreamingMsgId(asstId);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let finalCitations: Citation[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "chunk") {
              accumulated += evt.content;
              setMessages((prev) =>
                prev.map((m) => m.id === asstId ? { ...m, content: accumulated } : m)
              );
            } else if (evt.type === "done") {
              accumulated = evt.full_answer || accumulated;
              finalCitations = evt.citations || [];
            }
          } catch {}
        }
      }

      // ── Finalise streaming message ────────────────────────────────────
      const finalMsg: Message = {
        id: asstId, role: "assistant", content: accumulated,
        citations: finalCitations,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isStreaming: false,
      };
      setMessages((prev) => prev.map((m) => m.id === asstId ? finalMsg : m));

      const finalConvs = convList.map((c) =>
        c.id === convId ? { ...c, messages: [...c.messages.filter((m) => m.id !== asstId), finalMsg] } : c
      );
      saveConversations(finalConvs);

    } catch (err: any) {
      console.error(err);
      const errMsg: Message = {
        id: asstId, role: "assistant",
        content: `⚠️ Error: ${err.message || "Unable to connect to Bangladesh Legal AI. Make sure the backend is running on port 8000."}`,
        citations: [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isStreaming: false,
      };
      setMessages((prev) => prev.map((m) => m.id === asstId ? errMsg : m));
    } finally {
      setIsLoading(false);
      setStreamingMsgId(null);
    }
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/80 backdrop-blur-md flex flex-col">

        {/* Brand */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight flex items-center gap-1.5">
              BD Legal <span className="text-emerald-400 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">AI</span>
            </h1>
            <p className="text-[11px] text-slate-400">Bangladesh Legal Companion</p>
          </div>
        </div>

        {/* New Chat */}
        <div className="p-4">
          <button
            onClick={handleStartNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/10 text-sm"
          >
            <Plus className="h-4 w-4" /> New Consultation
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
          <div className="px-3 mb-2 flex items-center justify-between text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
            <span className="flex items-center gap-1"><History className="h-3 w-3" /> Sessions</span>
            <span>{conversations.length}</span>
          </div>

          {conversations.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-500">No sessions yet.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectConversation(c.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-colors group relative ${
                  activeConvId === c.id
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                    : "hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs font-medium flex-1">{c.title}</span>
                <span
                  onClick={(e) => handleDeleteConversation(e, c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-500 hover:text-rose-400 transition-all"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </button>
            ))
          )}
        </div>

        {/* Bottom Panel */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link href="/admin" className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-sm border border-slate-800/50">
            <span className="flex items-center gap-2 font-medium">
              <LayoutDashboard className="h-4 w-4 text-emerald-400" /> Document Admin
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/40 border border-slate-800/50">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <div>
                <p className="text-xs font-semibold truncate max-w-[110px]">
                  {user?.fullName || user?.username || "Legal Scholar"}
                </p>
                <p className="text-[10px] text-emerald-400">Authenticated</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Workspace ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col bg-slate-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/4 blur-[120px] rounded-full -z-10 pointer-events-none" />

        {/* Header */}
        <header className="h-14 shrink-0 border-b border-slate-800/60 bg-slate-950/60 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <h2 className="font-semibold text-xs tracking-widest text-slate-300 uppercase">
              Interactive Legal AI · Llama 3.3 · RAG Pipeline
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 border border-slate-800 hover:border-emerald-500/30 px-3 py-1.5 rounded-lg transition-all"
              >
                <Download className="h-3.5 w-3.5" /> Export PDF
              </button>
            )}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900 border border-slate-800 py-1.5 px-3 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </div>
          </div>
        </header>

        {/* Workspace Body */}
        <div className="flex-1 overflow-hidden flex">

          {/* Chat Panel */}
          <div className="flex-1 flex flex-col h-full">
            {messages.length === 0 ? (
              /* Welcome Screen */
              <div className="flex-1 overflow-y-auto px-8 py-12 flex flex-col justify-center items-center max-w-3xl mx-auto text-center">
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 mb-6">
                  <Scale className="h-10 w-10" />
                </div>
                <h3 className="text-3xl font-extrabold text-white tracking-tight">
                  Legal Assistant for{" "}
                  <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                    Bangladesh Laws
                  </span>
                </h3>
                <p className="mt-4 text-slate-400 max-w-xl text-sm leading-relaxed">
                  Ask in <strong className="text-white">English</strong> or <strong className="text-white">বাংলা</strong> about the Constitution, Penal Code, Labour Act, Land regulations, and custom uploaded PDF archives.
                </p>
                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                  {samplePrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(p.text)}
                      className="text-left p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 hover:border-emerald-500/30 transition-all duration-200 flex flex-col gap-1.5 group"
                    >
                      <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">{p.category}</span>
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors flex items-start gap-1">
                        {p.text}
                        <ArrowRight className="h-3 w-3 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Messages */
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-1">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className={`max-w-2xl rounded-2xl px-4 py-3 ${
                      m.role === "user"
                        ? "bg-emerald-500 text-slate-950 font-medium"
                        : "bg-slate-900 border border-slate-800"
                    }`}>
                      {/* Message content with streaming cursor */}
                      <div className="text-sm leading-relaxed whitespace-pre-line">
                        {m.content}
                        {m.isStreaming && (
                          <span className="inline-block w-0.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-middle" />
                        )}
                        {m.isStreaming && !m.content && (
                          <span className="text-slate-400 italic text-xs">Consulting legal statutes…</span>
                        )}
                      </div>

                      {/* Citations */}
                      {m.role === "assistant" && m.citations && m.citations.length > 0 && !m.isStreaming && (
                        <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap gap-1.5 items-center">
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" /> Sources:
                          </span>
                          {m.citations.map((cite, idx) => {
                            const cs = getConfidenceStyle(cite.confidence);
                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedCitation(cite)}
                                className={`text-[11px] bg-slate-800 border hover:border-emerald-500/50 px-2 py-0.5 rounded transition-all flex items-center gap-1 ${cs.text} border-slate-700`}
                              >
                                {cite.source.split("/").pop()} ·p{cite.page}
                                {cite.confidence !== undefined && (
                                  <span className={`ml-1 font-bold ${cs.text}`}>{cs.label}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className={`text-[10px] mt-1.5 text-right ${m.role === "user" ? "text-slate-900/50" : "text-slate-600"}`}>
                        {m.timestamp}
                      </div>
                    </div>
                    {m.role === "user" && (
                      <div className="h-7 w-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 mt-1">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-1">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-sm text-slate-400">Consulting legal statutes & constitution…</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Input */}
            <div className="p-5 border-t border-slate-800/60 bg-slate-950/80 backdrop-blur-md">
              <div className="max-w-4xl mx-auto flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 focus-within:border-emerald-500/40 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  placeholder="Ask any legal question in English or বাংলা…"
                  className="flex-1 bg-transparent border-0 outline-none text-sm px-3 text-slate-100 placeholder:text-slate-500 focus:ring-0"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || streamingMsgId !== null || !input.trim()}
                  className="p-2.5 bg-emerald-500 text-slate-950 rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-40 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-600 mt-2">
                Disclaimer: AI responses are generated via RAG pipeline over statutes. Verify with licensed legal counsels for litigation.
              </p>
            </div>
          </div>

          {/* ── Citation Inspector Panel ────────────────────────────────── */}
          {selectedCitation && (
            <div className="w-80 border-l border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-400" /> Citation Inspector
                </h3>
                <button
                  onClick={() => setSelectedCitation(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Source */}
                <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Source Document</p>
                  <p className="text-sm font-semibold text-white mt-1 break-all">{selectedCitation.source.split("/").pop()}</p>
                </div>

                {/* Page + Confidence */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Page</p>
                    <p className="text-lg font-bold text-white mt-1">{selectedCitation.page}</p>
                  </div>
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Confidence</p>
                    {selectedCitation.confidence !== undefined ? (
                      <>
                        <p className={`text-lg font-bold mt-1 ${getConfidenceStyle(selectedCitation.confidence).text}`}>
                          {selectedCitation.confidence}%
                        </p>
                        <div className="mt-1.5 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getConfidenceStyle(selectedCitation.confidence).bar}`}
                            style={{ width: `${selectedCitation.confidence}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">FAISS Match</p>
                    )}
                  </div>
                </div>

                {/* Retrieved Text */}
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Retrieved Passage</p>
                  <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-300 whitespace-pre-line italic">
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
