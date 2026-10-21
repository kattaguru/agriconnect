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


class Settings:
    database_url: str = os.getenv("DATABASE_URL") or _default_db_url()
    direct_url: str = os.getenv("DIRECT_URL", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-secret-change-me-dev-only-secret-change-me")
    jwt_expiry_minutes: int = int(os.getenv("JWT_EXPIRY_MINUTES", "720"))
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")
    supabase_url: str = os.getenv("SUPABASE_URL", "https://gpvdskwksuwmoaptlpef.supabase.co")
    supabase_publishable_key: str = os.getenv(
        "SUPABASE_PUBLISHABLE_KEY",
        os.getenv("SUPABASE_ANON_KEY", "sb_publishable_5iFc-sAm2HXbag5iaBFjqw_jaCNdDvH")
    )
    supabase_secret_key: str = os.getenv("SUPABASE_SECRET_KEY", "")
    supabase_jwks_url: str = os.getenv(
        "SUPABASE_JWKS_URL", "https://gpvdskwksuwmoaptlpef.supabase.co/auth/v1/.well-known/jwks.json"
    )


settings = Settings()
