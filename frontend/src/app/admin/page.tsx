"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { 
  Scale, 
  UploadCloud, 
  Database, 
  FileText, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Server, 
  FileCode,
  Loader2,
  RefreshCw
} from "lucide-react";

interface LegalDocument {
  id: number;
  filename: string;
  chunk_count: number;
  upload_date: string;
  status: string;
}

export default function AdminDashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [stats, setStats] = useState({ total_docs: 0, total_chunks: 0, faiss_status: "Healthy" });

  const getApiBase = () => {
    let url = (process.env.NEXT_PUBLIC_API_URL || "https://bd-legal-assistant-1.onrender.com").trim().replace(/\/+$/, "");

    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.startsWith("10.") || hostname.startsWith("172.");
      
      if (isLocalHost) {
        if (!process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL.includes("localhost")) {
          const protocol = window.location.protocol;
          return `${protocol}//${hostname}:8000`;
        }
      }
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    if (url.endsWith("/api")) {
      url = url.slice(0, -4);
    }
    return url;
  };
  const API_BASE = getApiBase();


  const fetchDocumentsAndStats = async () => {
    setLoadingDocs(true);
    setBackendError(null);
    const retries = 3;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(`${API_BASE}/api/documents`);
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setDocuments(data.documents || []);
        setStats({
          total_docs: data.documents?.length || 0,
          total_chunks: data.documents?.reduce((acc: number, curr: LegalDocument) => acc + curr.chunk_count, 0) || 0,
          faiss_status: "Active (Local Index)"
        });
        setBackendError(null);
        setLoadingDocs(false);
        return;
      } catch (error: any) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 2000 * attempt));
        } else {
          console.error("Failed to load documents", error);
          const isNetworkError = error instanceof TypeError || error.message.includes("fetch") || error.message.includes("Load failed");
          setBackendError(
            isNetworkError
              ? `Connecting to backend at ${API_BASE}... (Render free servers take 30-50s to wake up on first load. Please click retry).`
              : `Backend error: ${error.message}`
          );
        }
      }
    }
    setLoadingDocs(false);
  };



  useEffect(() => {
    fetchDocumentsAndStats();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadStatus({ type: null, message: "" });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setUploadStatus({ type: null, message: "" });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Upload failed");
      }

      const data = await response.json();
      setUploadStatus({
        type: "success",
        message: `Successfully processed "${file.name}"! Created ${data.chunk_count || 0} chunks & added to FAISS vector store.`
      });
      setFile(null);
      // Reset input element
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      fetchDocumentsAndStats();
    } catch (error: any) {
      console.error(error);
      const isNetworkError = error instanceof TypeError || error.message.includes("fetch") || error.message.includes("Load failed");
      setUploadStatus({
        type: "error",
        message: isNetworkError
          ? `Connection error. If deploying on Render Free Tier, please wait ~30 seconds for the backend to wake up and try uploading again.`
          : error.message || "Failed to process and index legal document."
      });
    } finally {
      setUploading(false);
    }
  };


  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document from the vector store?")) return;

    try {
      const response = await fetch(`${API_BASE}/api/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setUploadStatus({
          type: "success",
          message: "Document deleted successfully."
        });
        fetchDocumentsAndStats();
      } else {
        throw new Error("Deletion failed");
      }
    } catch (error) {
      console.error(error);
      setUploadStatus({
        type: "error",
        message: "Failed to delete document from database/vector store."
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-900 bg-slate-900/60 backdrop-blur-md flex items-center justify-between px-8 z-10">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-emerald-500" />
            <h1 className="font-bold text-lg">BD Legal Admin Portal</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fetchDocumentsAndStats()}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-6">
        {/* Backend Connection Error Banner */}
        {backendError && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Backend Connection Failed</p>
              <p className="mt-0.5 text-rose-400/80">{backendError}</p>
              <button
                onClick={() => fetchDocumentsAndStats()}
                className="mt-2 text-xs underline hover:text-rose-300 transition-colors"
              >
                Retry connection
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Upload & System Stats */}
        <div className="lg:col-span-1 space-y-8">
          {/* Upload Form */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-850 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-emerald-400" />
                Ingest Legal Statutes
              </h2>
              <p className="text-xs text-slate-400 mt-1">Upload PDF documents (Acts, Ordinances, Gazettes) to segment and index.</p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/40 rounded-xl p-6 transition-all text-center">
                <input 
                  type="file" 
                  id="file-upload" 
                  accept=".pdf" 
                  onChange={handleFileChange}
                  className="hidden" 
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                  <Database className="h-10 w-10 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-200">
                    {file ? file.name : "Select PDF Document"}
                  </span>
                  <span className="text-xs text-slate-500">
                    {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : "Maximum size 25MB"}
                  </span>
                </label>
              </div>

              {uploadStatus.type && (
                <div className={`p-4 rounded-xl flex gap-3 text-sm ${
                  uploadStatus.type === "success" 
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" 
                    : "bg-destructive/10 border border-destructive/20 text-destructive-foreground"
                }`}>
                  {uploadStatus.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                  <span className="leading-normal">{uploadStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Ingesting Embeddings...
                  </>
                ) : (
                  <>
                    <Database className="h-5 w-5" />
                    Process & Index Document
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Infrastructure Metrics */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-850 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">RAG Infrastructure</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                <p className="text-xs text-slate-500">Vector Store</p>
                <p className="text-sm font-semibold mt-1">FAISS Index</p>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                <p className="text-xs text-slate-500">Embedding Engine</p>
                <p className="text-xs font-semibold mt-1 truncate">bge-small-en-v1.5</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 flex items-center gap-1.5"><Server className="h-4 w-4" /> Vector Index State</span>
                <span className="text-emerald-400 font-medium">{stats.faiss_status}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 flex items-center gap-1.5"><FileCode className="h-4 w-4" /> DB Tables (SQL)</span>
                <span className="text-emerald-400 font-medium">Ready</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Document Records */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white">Ingested Corpus</h2>
              <p className="text-sm text-slate-400 mt-1">Total {stats.total_docs} legal document sources containing {stats.total_chunks} index vectors.</p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-slate-850 overflow-hidden">
            {loadingDocs ? (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                <span className="text-sm text-slate-400">Loading statutory index...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-20 text-center text-slate-500 text-sm">
                No statutes registered. Use the panel on the left to upload Bangladeshi legal codes.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-5 flex items-center justify-between hover:bg-slate-900/40 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white break-all max-w-[280px] md:max-w-md">{doc.filename}</h4>
                        <div className="flex gap-4 mt-1.5 text-xs text-slate-400">
                          <span>Vectors: <strong className="text-slate-200">{doc.chunk_count} chunks</strong></span>
                          <span>•</span>
                          <span>Uploaded: <strong className="text-slate-200">{new Date(doc.upload_date).toLocaleDateString()}</strong></span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="p-2.5 bg-slate-900 border border-slate-850 rounded-lg text-slate-400 hover:text-rose-400 hover:border-rose-500/20 transition-all"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </main>
    </div>
  );
}
