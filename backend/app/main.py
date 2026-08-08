import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("bd-legal-assistant")

from app.database import engine, Base
from app.api.endpoints.legal_endpoints import router as legal_router

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Bangladesh AI Legal Assistant",
    version="1.0.0",
    debug=settings.DEBUG
)

# Set up CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API Router
app.include_router(legal_router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to Bangladesh AI Legal Assistant API", "status": "healthy"}
