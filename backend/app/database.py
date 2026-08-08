from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# If sqlite is used for testing or fallback
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

try:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True
    )
except Exception:
    engine = create_engine(
        "sqlite:///./sql_app.db",
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
