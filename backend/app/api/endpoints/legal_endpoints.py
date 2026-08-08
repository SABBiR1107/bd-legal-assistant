from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
import os
import shutil
from typing import List
from app.database import get_db
from app.models.legal_models import DocumentModel
from app.schemas.legal_schemas import ChatRequest, ChatResponse, DocumentListResponse, DocumentResponse
from app.services.ai_pipeline import ingest_pdf, query_rag_pipeline

router = APIRouter()

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    # Save file temporarily
    temp_dir = "temp"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, file.filename)
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Check if already exists in DB
        db_doc = db.query(DocumentModel).filter(DocumentModel.filename == file.filename).first()
        if db_doc:
            raise HTTPException(status_code=400, detail="Document with this name already uploaded.")

        # Trigger Ingestion
        chunk_count = await ingest_pdf(temp_path, file.filename)

        # Save record to database
        new_doc = DocumentModel(
            filename=file.filename,
            chunk_count=chunk_count,
            status="processed"
        )
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
        return new_doc

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@router.get("/documents", response_model=DocumentListResponse)
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(DocumentModel).all()
    return {"documents": docs}

@router.delete("/documents/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Delete document record
        db.delete(doc)
        db.commit()
        
        # Note: In a complete production codebase, we would rebuild/filter the FAISS index or remove vectors.
        # For simplicity, we delete the metadata, and the FAISS query matches are handled gracefully.
        return {"status": "success", "message": "Document deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat", response_model=ChatResponse)
async def chat_interaction(payload: ChatRequest):
    try:
        answer, citations = await query_rag_pipeline(payload.message, payload.history)
        return {"answer": answer, "citations": citations}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG reasoning failed: {str(e)}")
