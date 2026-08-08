import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"

import logging
from fastapi import FastAPI, Request
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

# ─── Rate Limiting (slowapi) ───────────────────────────────────────────────
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

    limiter = Limiter(key_func=get_remote_address, default_limits=["200/day", "60/hour"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    logger.info("✅ Rate limiting enabled (slowapi)")
except ImportError:
    logger.warning("⚠️ slowapi not installed — rate limiting disabled. Run: pip install slowapi")

# ─── CORS ─────────────────────────────────────────────────────────────────
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ─── Routers ──────────────────────────────────────────────────────────────
app.include_router(legal_router, prefix="/api")


@app.get("/")
def read_root():
    return {
        "message": "Welcome to Bangladesh AI Legal Assistant API",
        "status": "healthy",
        "version": "2.0.0",
        "features": ["RAG Pipeline", "Bengali Support", "Streaming SSE", "Chat History", "Rate Limiting"]
    }
