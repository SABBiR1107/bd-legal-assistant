import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path

class Settings(BaseSettings):
    PROJECT_NAME: str = "Bangladesh AI Legal Assistant API"
    DEBUG: bool = False
    
    # Database Settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")
    
    # Groq API Key
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    
    # Embeddings: fastembed BAAI/bge-small-en-v1.5 (ONNX, ~70MB RAM)
    # Defined in ai_pipeline.py - kept here for reference only
    EMBEDDING_MODEL_NAME: str = "BAAI/bge-small-en-v1.5"
    
    # FAISS local path
    FAISS_INDEX_PATH: str = os.getenv("FAISS_INDEX_PATH", str(Path(__file__).parent.parent / "data" / "faiss"))
    
    # CORS Origins
    BACKEND_CORS_ORIGINS: list[str] = ["*"]
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
