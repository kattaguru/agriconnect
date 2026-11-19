import os
from pathlib import Path
try:
    from dotenv import load_dotenv

    _BASE_DIR = Path(__file__).resolve().parent.parent
    load_dotenv(_BASE_DIR / ".env")
    load_dotenv()  # fallback to cwd if any
except ImportError:
    pass


def _default_db_url() -> str:
    if os.getenv("VERCEL"):
        return "sqlite:////tmp/agriconnect.db"
    return "sqlite:///./agriconnect.db"


def _get_database_url() -> str:
    raw = (os.getenv("DATABASE_URL") or "").strip()
    if not raw or "[YOUR-PASSWORD]" in raw:
        return _default_db_url()
    return raw


class Settings:
    database_url: str = _get_database_url()
    direct_url: str = os.getenv("DIRECT_URL", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-secret-change-me-dev-only-secret-change-me")
    jwt_expiry_minutes: int = int(os.getenv("JWT_EXPIRY_MINUTES", "720"))
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_publishable_key: str = os.getenv(
        "SUPABASE_PUBLISHABLE_KEY",
        os.getenv("SUPABASE_ANON_KEY", "")
    )
    supabase_secret_key: str = os.getenv("SUPABASE_SECRET_KEY", "")
    supabase_jwks_url: str = os.getenv(
        "SUPABASE_JWKS_URL",
        f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/auth/v1/.well-known/jwks.json"
        if os.getenv("SUPABASE_URL")
        else ""
    )
    crop_disease_ai_url: str = os.getenv("CROP_DISEASE_AI_URL", "http://127.0.0.1:8000")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    pinecone_api_key: str = os.getenv("PINECONE_API_KEY", "")
    pinecone_index: str = os.getenv("PINECONE_INDEX_NAME", "cropdisease-rag")
    pinecone_namespace: str = os.getenv("PINECONE_NAMESPACE", "agricultural-rag")


settings = Settings()
