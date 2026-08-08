import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "Bangladesh AI Legal Assistant API"
    DEBUG: bool = True
    
    # Database Settings
    DATABASE_URL: str = "postgresql://postgres:postgrespassword@localhost:5432/bd_legal_assistant"
    
    # Groq API Key
    GROQ_API_KEY: str = ""
    
    # Embeddings - Multilingual model supports Bengali + English + 50 other languages
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    
    # FAISS local path
    FAISS_INDEX_PATH: str = str(Path(__file__).parent.parent / "data" / "faiss")
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
