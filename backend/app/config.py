"""Centralized, strongly-typed configuration loaded from environment and .env files."""
import logging
import secrets
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent

# Search for .env in backend directory first, then repository root
_candidate_env_paths = [BASE_DIR / ".env", BASE_DIR.parent / ".env"]
_active_env_files = [str(p) for p in _candidate_env_paths if p.is_file()]

for p in _candidate_env_paths:
    if p.is_file():
        load_dotenv(p, override=False)


class Settings(BaseSettings):
    """Application Settings schema with full type safety."""

    ENV: str = "development"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    DATABASE_URL: str = Field(default="sqlite:///./portfolio.db")

    FRONTEND_URLS: str = "http://localhost:5173"
    FRONTEND_URL: Optional[str] = None  # Legacy support

    PUBLIC_API_URL: str = "http://localhost:8000"
    PUBLIC_ADMIN_URL: str = "http://localhost:5173/admin"

    SECRET_KEY: str = ""

    SESSION_IDLE_MINUTES: int = 120
    SESSION_MAX_HOURS: int = 12

    STORAGE_BACKEND: str = "local"
    MEDIA_DIR: str = "./media"
    CLOUDINARY_URL: str = ""

    VERCEL_DEPLOY_HOOK_URL: str = ""
    VERCEL_TOKEN: str = ""
    VERCEL_PROJECT_ID: str = ""

    KIRBY_ENABLED: bool = True
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "nvidia/nemotron-3-nano-30b-a3b:free"
    EMBEDDINGS_PROVIDER: str = "hf"
    HUGGINGFACE_API_TOKEN: str = ""
    HF_EMBEDDINGS_URL: str = (
        "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction"
    )
    KB_MIN_SCORE: float = 0.35

    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASS: str = ""
    ADMIN_NOTIFY_EMAIL: str = ""

    # Startup warm-up + maintenance loop. Disabled in tests.
    BACKGROUND_TASKS: bool = True

    ANALYTICS_RETENTION_DAYS: int = 395
    CHAT_RETENTION_DAYS: int = 365

    model_config = SettingsConfigDict(
        env_file=tuple(_active_env_files) if _active_env_files else (".env",),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_and_fallback_keys(self) -> "Settings":
        if self.ENV == "production" and not self.SECRET_KEY:
            raise ValueError("SECRET_KEY is required in production")
        if not self.SECRET_KEY:
            logger.warning("SECRET_KEY unset in development; generating ephemeral random secret key.")
            object.__setattr__(self, "SECRET_KEY", secrets.token_hex(32))
        return self

    @property
    def normalized_database_url(self) -> str:
        """Convert standard postgres:// or postgresql:// to modern postgresql+psycopg://."""
        url = (self.DATABASE_URL or "sqlite:///./portfolio.db").strip()
        if url.startswith("postgres://"):
            return "postgresql+psycopg://" + url[len("postgres://"):]
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def frontend_origins(self) -> List[str]:
        """List of allowed origins for CORS parsed from FRONTEND_URLS and legacy FRONTEND_URL."""
        import os

        urls_set = "FRONTEND_URLS" in os.environ
        legacy_set = "FRONTEND_URL" in os.environ or (
            self.FRONTEND_URL and self.FRONTEND_URL != "http://localhost:5173"
        )

        if legacy_set and not urls_set:
            return [u.strip() for u in (self.FRONTEND_URL or "").split(",") if u.strip()] or ["http://localhost:5173"]

        origins = [u.strip() for u in self.FRONTEND_URLS.split(",") if u.strip()]
        if self.FRONTEND_URL and self.FRONTEND_URL != "http://localhost:5173":
            for u in self.FRONTEND_URL.split(","):
                u_str = u.strip()
                if u_str and u_str not in origins:
                    origins.append(u_str)

        return origins or ["http://localhost:5173"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Instantiate and return cached settings."""
    return Settings()
