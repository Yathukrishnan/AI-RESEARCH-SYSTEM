from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # ── Turso ─────────────────────────────────────────────────────────────────
    TURSO_DATABASE_URL: str = "libsql://placeholder.turso.io"
    TURSO_AUTH_TOKEN: str = ""

    # ── OpenRouter (protected – never exposed via API) ─────────────────────────
    OPENROUTER_API_KEY: str = ""

    # ── JWT ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"

    # ── Admin ─────────────────────────────────────────────────────────────────
    ADMIN_EMAIL: str = "admin@research.ai"
    ADMIN_PASSWORD: str = "Admin123!"

    # ── Feed ──────────────────────────────────────────────────────────────────
    PAPERS_PER_DAY: int = 20
    INITIAL_FETCH_DAYS: int = 30
    SCR_THRESHOLD: float = 0.5

    # ── Scoring weights (new papers ≤7 days) ──────────────────────────────────
    W_RELEVANCE: float = 0.35
    W_AUTHOR_H: float = 0.20
    W_GIT: float = 0.15
    W_RECENCY: float = 0.30

    # ── Scoring weights (old papers >7 days) ──────────────────────────────────
    W_CITATIONS: float = 0.30
    W_AUTHOR_OLD: float = 0.20
    W_AI_IMPACT: float = 0.30
    W_GIT_OLD: float = 0.20
    DECAY_LAMBDA: float = 0.01

    # ── External APIs (editable from admin, stored in DB) ─────────────────────
    ARXIV_API_URL: str = "http://export.arxiv.org/api/query"
    SEMANTIC_SCHOLAR_API_URL: str = "https://api.semanticscholar.org/graph/v1"
    PAPERS_WITH_CODE_API_URL: str = "https://paperswithcode.com/api/v1"

    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "AI Research Intelligence System"
    DEBUG: bool = False
    # Comma-separated list of allowed origins (set FRONTEND_URL in Render dashboard)
    FRONTEND_URL: str = ""
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    def get_cors_origins(self) -> List[str]:
        origins = list(self.CORS_ORIGINS)
        if self.FRONTEND_URL:
            for url in self.FRONTEND_URL.split(","):
                url = url.strip()
                if url and url not in origins:
                    origins.append(url)
        return origins

    @property
    def turso_http_url(self) -> str:
        """Convert libsql:// URL to https:// for HTTP API."""
        return self.TURSO_DATABASE_URL.replace("libsql://", "https://")

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
