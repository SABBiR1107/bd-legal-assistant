from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class HistoryItem(BaseModel):
    role: str  # user, assistant
    content: str

class ChatRequest(BaseModel):
    message: str = Field(..., description="The user query on Bangladesh laws")
    history: Optional[List[HistoryItem]] = Field(default=[], description="Previous conversation messages")

class CitationSchema(BaseModel):
    source: str
    page: int
    content: str

class ChatResponse(BaseModel):
    answer: str
    citations: List[CitationSchema]

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
