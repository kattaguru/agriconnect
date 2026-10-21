import os
from pathlib import Path
from dotenv import load_dotenv

_BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(_BASE_DIR / ".env")
load_dotenv()  # fallback to cwd if any


class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./agriconnect.db")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-secret-change-me-dev-only-secret-change-me")
    jwt_expiry_minutes: int = int(os.getenv("JWT_EXPIRY_MINUTES", "720"))
    cors_origins: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")


settings = Settings()
