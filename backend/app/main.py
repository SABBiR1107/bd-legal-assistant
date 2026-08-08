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

# ─── CORS (Must be added first so all responses & preflights have CORS headers) ──
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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



# ─── Startup ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    # NOTE: Embedding model loads lazily on first request to stay within
    # Render Free Tier 512MB RAM limit. Do NOT pre-warm here.
    logger.info("✅ Server started. Embedding model will load on first request.")

# ─── Routers ──────────────────────────────────────────────────────────────
app.include_router(legal_router, prefix="/api")



@app.get("/")
@app.get("/health")
def read_root():
    return {
        "message": "Welcome to Bangladesh AI Legal Assistant API",
        "status": "healthy",
        "version": "2.0.0",
        "features": ["RAG Pipeline", "Bengali Support", "Streaming SSE", "Chat History", "Rate Limiting"]
    }
