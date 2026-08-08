import os
import re
import asyncio
import logging
import pickle
from typing import List, Tuple, Dict, Any
from PyPDF2 import PdfReader
from langchain.text_splitter import RecursiveCharacterTextSplitter
import faiss
import numpy as np
from app.config import settings


logger = logging.getLogger("ai_pipeline")

# ─── Language Detection ───────────────────────────────────────────────────────
def detect_language(text: str) -> str:
    """
    Detect if the query is in Bengali or English.
    Returns 'bn' for Bengali, 'en' for English.
    """
    bengali_chars = len(re.findall(r'[\u0980-\u09FF]', text))
    total_chars = len(text.replace(' ', ''))
    if total_chars == 0:
        return 'en'
    bengali_ratio = bengali_chars / total_chars
    return 'bn' if bengali_ratio > 0.2 else 'en'

# Initialize Embedding Model lazily
_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        import torch
        torch.set_num_threads(1)
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading sentence-transformer: {settings.EMBEDDING_MODEL_NAME}")
        _embedding_model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
    return _embedding_model



class LocalFAISSStore:
    def __init__(self):
        self.index_path = settings.FAISS_INDEX_PATH
        self.index_file = os.path.join(self.index_path, "index.faiss")
        self.meta_file = os.path.join(self.index_path, "metadata.pkl")
        
        # Dimensions for bge-small-en-v1.5 is 384
        self.dimension = 384 
        self.index = None
        self.metadata = [] # List of dicts matching FAISS indices: {"source": str, "page": int, "content": str}
        
        self.load_index()

    def load_index(self):
        os.makedirs(self.index_path, exist_ok=True)
        if os.path.exists(self.index_file) and os.path.exists(self.meta_file):
            try:
                self.index = faiss.read_index(self.index_file)
                with open(self.meta_file, "rb") as f:
                    self.metadata = pickle.load(f)
                logger.info(f"Loaded existing FAISS index with {len(self.metadata)} vectors.")
            except Exception as e:
                logger.error(f"Failed to load FAISS index: {e}. Reinitializing.")
                self._initialize_empty()
        else:
            self._initialize_empty()

    def _initialize_empty(self):
        self.index = faiss.IndexFlatIP(self.dimension)  # Inner Product (cosine similarity since vectors are normalized)
        self.metadata = []
        logger.info("Initialized empty FAISS index.")

    def save_index(self):
        os.makedirs(self.index_path, exist_ok=True)
        faiss.write_index(self.index, self.index_file)
        with open(self.meta_file, "wb") as f:
            pickle.dump(self.metadata, f)
        logger.info("Saved FAISS index to disk.")

    def add_texts(self, texts: List[str], metadatas: List[Dict[str, Any]]):
        model = get_embedding_model()
        # Compute embeddings efficiently with batching
        embeddings = model.encode(
            texts,
            batch_size=32,
            show_progress_bar=False,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        
        # Add to index
        self.index.add(embeddings)
        self.metadata.extend(metadatas)
        self.save_index()

    def similarity_search(self, query: str, k: int = 4) -> List[Dict[str, Any]]:
        if len(self.metadata) == 0:
            return []
        
        model = get_embedding_model()
        query_vector = model.encode([query], batch_size=1, show_progress_bar=False, convert_to_numpy=True, normalize_embeddings=True)
        
        distances, indices = self.index.search(query_vector, k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            item = self.metadata[idx].copy()
            item["score"] = float(dist)
            results.append(item)
        return results

# Singleton instance of vector store
vector_store = None

def get_vector_store():
    global vector_store
    if vector_store is None:
        vector_store = LocalFAISSStore()
    return vector_store

async def ingest_pdf(pdf_path: str, filename: str) -> int:
    """
    Extracts text from PDF, chunks it, embeds and saves to FAISS.
    Returns the number of chunks added.
    """
    logger.info(f"Starting ingestion for {filename}")
    reader = PdfReader(pdf_path)
    
    chunks = []
    metadatas = []
    
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
        length_function=len
    )

    
    for i, page in enumerate(reader.pages):
        page_num = i + 1
        text = page.extract_text()
        if not text or not text.strip():
            continue
            
        page_chunks = text_splitter.split_text(text)
        for chunk in page_chunks:
            chunks.append(chunk)
            metadatas.append({
                "source": filename,
                "page": page_num,
                "content": chunk
            })
            
    if chunks:
        store = get_vector_store()
        await asyncio.to_thread(store.add_texts, chunks, metadatas)
        logger.info(f"Ingested {len(chunks)} chunks from {filename}")
        
    return len(chunks)

async def query_rag_pipeline(query: str, history: List[Any] = []) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Given a query, retrieves context from FAISS and queries Gemini to get a citation-based answer.
    """
    store = get_vector_store()
    retrieved_items = await asyncio.to_thread(store.similarity_search, query, 4)

    
    # Format context
    context_str = ""
    citations = []
    
    for i, item in enumerate(retrieved_items):
        context_str += f"[Source {i+1}]: {item['source']} (Page {item['page']})\nContent: {item['content']}\n\n"
        confidence = round(min(max(float(item.get('score', 0)), 0), 1) * 100, 1)
        citations.append({
            "source": item["source"],
            "page": item["page"],
            "content": item["content"],
            "confidence": confidence
        })
        
    # ─── Detect language and build bilingual prompt ───────────────────────────
    user_lang = detect_language(query)
    
    if user_lang == 'bn':
        language_instruction = (
            "IMPORTANT: The user has asked in Bengali (বাংলা). You MUST respond entirely in Bengali (বাংলা). "
            "Use formal Bengali legal terminology. Do not respond in English.\n"
        )
    else:
        language_instruction = (
            "The user has asked in English. Respond in clear, professional English.\n"
        )

    # Construct LLM prompt
    system_prompt = (
        "You are an expert AI Legal Assistant (আইনি সহকারী) specializing in Bangladeshi law "
        "(বাংলাদেশের আইন ও সংবিধান). Your task is to answer the user's legal query based on "
        "the retrieved context segments of laws and constitution.\n\n"
        f"{language_instruction}"
        "Strictly adhere to the following rules:\n"
        "1. Provide a professional, precise, and citation-based legal answer.\n"
        "2. Cite your sources clearly by referencing the document name and page number from the context.\n"
        "3. If the retrieved context does not contain enough information to answer, state that the "
        "context is insufficient, but provide a helpful general answer based on your knowledge of "
        "Bangladesh laws — clearly distinguishing between your knowledge and the retrieved context.\n"
        "4. Answer in the SAME LANGUAGE the user used to ask the question.\n\n"
        "Retrieved Context:\n"
        f"{context_str}\n"
        f"User Query: {query}"
    )

    # Let's import Groq integration
    from langchain_groq import ChatGroq
    
    try:
        # Initialize Groq using Llama 3.3 70B
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            groq_api_key=settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
        )
        
        response = await llm.ainvoke(system_prompt)
        answer = response.content
    except Exception as e:
        logger.error(f"Failed to use langchain-groq: {e}. Falling back to mockup answer.")
        answer = (
            f"Note: Groq API execution fell back or wasn't configured with a valid GROQ_API_KEY.\n\n"
            f"Based on the retrieved Bangladeshi statutes from '{citations[0]['source'] if citations else 'Constitution'}':\n"
            f"\"{citations[0]['content'][:300] if citations else 'No context loaded.'}...\"\n\n"
            f"For professional counsel, please configure your GROQ_API_KEY in the backend .env configuration."
        )

    return answer, citations


async def stream_rag_pipeline(query: str, history: list = []):
    """
    Streaming version of query_rag_pipeline.
    Yields dicts: {type: 'chunk', content: str} and finally {type: 'done', full_answer, citations}
    """
    store = get_vector_store()
    retrieved_items = await asyncio.to_thread(store.similarity_search, query, 4)


    context_str = ""
    citations = []
    for i, item in enumerate(retrieved_items):
        context_str += f"[Source {i+1}]: {item['source']} (Page {item['page']})\nContent: {item['content']}\n\n"
        confidence = round(min(max(float(item.get('score', 0)), 0), 1) * 100, 1)
        citations.append({
            "source": item["source"],
            "page": item["page"],
            "content": item["content"],
            "confidence": confidence
        })

    user_lang = detect_language(query)
    language_instruction = (
        "IMPORTANT: The user has asked in Bengali (\u09ac\u09be\u0982\u09b2\u09be). You MUST respond entirely in Bengali. "
        "Use formal Bengali legal terminology. Do not respond in English.\n"
        if user_lang == 'bn' else
        "The user has asked in English. Respond in clear, professional English.\n"
    )

    system_prompt = (
        "You are an expert AI Legal Assistant (\u0986\u0987\u09a8\u09bf \u09b8\u09b9\u0995\u09be\u09b0\u09c0) specializing in Bangladeshi law "
        "(\u09ac\u09be\u0982\u09b2\u09be\u09a6\u09c7\u09b6\u09c7\u09b0 \u0986\u0987\u09a8 \u0993 \u09b8\u0982\u09ac\u09bf\u09a7\u09be\u09a8).\n\n"
        f"{language_instruction}"
        "Rules:\n"
        "1. Provide professional, precise, citation-based legal answers.\n"
        "2. Cite sources by document name and page number.\n"
        "3. If context is insufficient, provide general knowledge while noting the limitation.\n"
        "4. Answer in the SAME LANGUAGE the user used.\n\n"
        f"Retrieved Context:\n{context_str}\n"
        f"User Query: {query}"
    )

    from langchain_groq import ChatGroq
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",
        groq_api_key=settings.GROQ_API_KEY or os.getenv("GROQ_API_KEY"),
        streaming=True
    )

    full_answer = ""
    try:
        async for chunk in llm.astream(system_prompt):
            if chunk.content:
                full_answer += chunk.content
                yield {"type": "chunk", "content": chunk.content}
    except Exception as e:
        logger.error(f"Streaming failed: {e}")
        full_answer = f"Streaming error: {str(e)}"
        yield {"type": "chunk", "content": full_answer}

    yield {"type": "done", "full_answer": full_answer, "citations": citations}
