# Bangladesh AI Legal Assistant - Backend Service

This is the FastAPI backend service providing the core REST API endpoints and RAG retrieval pipelines for the Bangladesh AI Legal Assistant.

## 🚀 Features
- **PDF Ingestion & Chunking**: Extracts texts from legal PDFs and splits them into overlap segments.
- **Semantic Vector Storage**: Computes vector embeddings using `bge-small-en-v1.5` and indexes them in a local FAISS index.
- **RAG Reasoning**: Retrieves relevant context from FAISS and triggers Gemini 2.5 Flash to generate professional legal responses.
- **Relational Metadata Store**: Logs active documents, chunk sizes, and timestamps in PostgreSQL (via Supabase / SQLAlchemy).

## 🛠️ Tech Stack
- **Framework**: FastAPI (Python 3.12)
- **AI/LLM Library**: LangChain
- **Embeddings**: Sentence-Transformers (`BAAI/bge-small-en-v1.5`)
- **Vector Database**: FAISS
- **Database ORM**: SQLAlchemy with PostgreSQL / SQLite support
- **Testing**: Pytest

## 📦 Getting Started

### 1. Environment Configurations
Create a `.env` file based on `.env.example` with:
```env
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/bd_legal_assistant"
GEMINI_API_KEY="AIzaSy..."
```

### 2. Local Run
Install dependencies and launch the dev server:
```bash
python -m venv venv
source venv/Scripts/activate # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt   
uvicorn app.main:app --reload --port 8000
```
Visit http://localhost:8000/docs for Swagger API interactive docs.
