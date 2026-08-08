import json
import uuid as uuid_module
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import os
import shutil
from typing import List, Optional
from app.database import get_db
from app.models.legal_models import DocumentModel, ConversationModel, MessageModel
from app.schemas.legal_schemas import (
    ChatRequest, ChatResponse, DocumentListResponse, DocumentResponse,
    ConversationListResponse, ConversationResponse, ConversationDetailResponse, MessageResponse
)
from app.services.ai_pipeline import ingest_pdf, query_rag_pipeline, stream_rag_pipeline

logger = logging.getLogger("legal_endpoints")
router = APIRouter()

# ─────────────────────────────────────────────────────────────────────────────
# Rate Limiter (slowapi)
# ─────────────────────────────────────────────────────────────────────────────
try:
    from slowapi import Limiter
    from slowapi.util import get_remote_address
    limiter = Limiter(key_func=get_remote_address)
    RATE_LIMITING_ENABLED = True
except ImportError:
    RATE_LIMITING_ENABLED = False
    logger.warning("slowapi not installed. Rate limiting disabled.")


def rate_limit(limit_str: str):
    """Decorator factory that applies rate limiting if slowapi is available."""
    def decorator(func):
        if RATE_LIMITING_ENABLED:
            return limiter.limit(limit_str)(func)
        return func
    return decorator


# ─────────────────────────────────────────────────────────────────────────────
# Document Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    temp_dir = "temp"
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, file.filename)

    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        db_doc = db.query(DocumentModel).filter(DocumentModel.filename == file.filename).first()
        if db_doc:
            raise HTTPException(status_code=400, detail="Document with this name already uploaded.")

        chunk_count = await ingest_pdf(temp_path, file.filename)

        new_doc = DocumentModel(filename=file.filename, chunk_count=chunk_count, status="processed")
        db.add(new_doc)
        db.commit()
        db.refresh(new_doc)
        return new_doc

    except HTTPException:
        raise
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
        db.delete(doc)
        db.commit()
        return {"status": "success", "message": "Document deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Chat Endpoint (Standard — saves to DB)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat_interaction(request: Request, payload: ChatRequest, db: Session = Depends(get_db)):
    try:
        answer, citations = await query_rag_pipeline(payload.message, payload.history)

        # ── Save conversation to DB ──────────────────────────────────────────
        conv_id = payload.conversation_id
        if not conv_id:
            conv_id = str(uuid_module.uuid4())
            title = payload.message[:60] + ("..." if len(payload.message) > 60 else "")
            conv = ConversationModel(id=conv_id, title=title)
            db.add(conv)
            db.flush()
        else:
            # Verify conversation exists, create if not (frontend-generated IDs)
            existing = db.query(ConversationModel).filter(ConversationModel.id == conv_id).first()
            if not existing:
                title = payload.message[:60] + ("..." if len(payload.message) > 60 else "")
                conv = ConversationModel(id=conv_id, title=title)
                db.add(conv)
                db.flush()

        # Save user message
        user_msg = MessageModel(
            id=str(uuid_module.uuid4()),
            conversation_id=conv_id,
            role="user",
            content=payload.message,
            citations=None
        )
        db.add(user_msg)

        # Save assistant message
        asst_msg = MessageModel(
            id=str(uuid_module.uuid4()),
            conversation_id=conv_id,
            role="assistant",
            content=answer,
            citations=citations
        )
        db.add(asst_msg)
        db.commit()

        return {"answer": answer, "citations": citations, "conversation_id": conv_id}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"RAG reasoning failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# ⚡ Streaming Chat Endpoint (SSE — ChatGPT-style)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/chat/stream")
async def stream_chat(request: Request, payload: ChatRequest):
    """
    Server-Sent Events streaming endpoint.
    Yields JSON chunks: {type: 'chunk', content: str}
    Final event:        {type: 'done', full_answer: str, citations: [...]}
    """
    async def generate():
        try:
            async for event in stream_rag_pipeline(payload.message, payload.history):
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        except Exception as e:
            error_event = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",   # Disable nginx buffering
            "Access-Control-Allow-Origin": "*",
        }
    )


# ─────────────────────────────────────────────────────────────────────────────
# Conversation History Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=ConversationListResponse)
def list_conversations(db: Session = Depends(get_db)):
    convs = (
        db.query(ConversationModel)
        .order_by(ConversationModel.created_at.desc())
        .limit(100)
        .all()
    )
    return {"conversations": convs}


@router.get("/conversations/{conv_id}", response_model=ConversationDetailResponse)
def get_conversation(conv_id: str, db: Session = Depends(get_db)):
    conv = db.query(ConversationModel).filter(ConversationModel.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = sorted(conv.messages, key=lambda m: m.timestamp)
    return {
        "id": conv.id,
        "title": conv.title,
        "created_at": conv.created_at,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "citations": m.citations,
                "timestamp": m.timestamp,
            }
            for m in messages
        ]
    }


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    conv = db.query(ConversationModel).filter(ConversationModel.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        db.delete(conv)
        db.commit()
        return {"status": "success", "message": "Conversation deleted"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
