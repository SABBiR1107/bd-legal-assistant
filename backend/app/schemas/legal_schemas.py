from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class HistoryItem(BaseModel):
    role: str  # user, assistant
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., description="The user query on Bangladesh laws")
    history: Optional[List[HistoryItem]] = Field(default=[], description="Previous conversation messages")
    conversation_id: Optional[str] = Field(default=None, description="Existing conversation ID to continue")


class CitationSchema(BaseModel):
    source: str
    page: int
    content: str
    confidence: float = Field(default=0.0, description="Similarity confidence score (0-100%)")


class ChatResponse(BaseModel):
    answer: str
    citations: List[CitationSchema]
    conversation_id: str


class DocumentResponse(BaseModel):
    id: int
    filename: str
    chunk_count: int
    upload_date: datetime
    status: str

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]


class ConversationResponse(BaseModel):
    id: str
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationListResponse(BaseModel):
    conversations: List[ConversationResponse]


class MessageResponse(BaseModel):
    id: str
    role: str
    content: str
    citations: Optional[List[CitationSchema]] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class ConversationDetailResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    messages: List[MessageResponse]
