"""Application configuration via pydantic-settings."""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """All environment variables for the backend."""

    # ── App ──
    APP_NAME: str = "YouTube Genius"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = "change-me-in-production"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8080"

    # ── Database ──
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/youtube_genius"

    # ── Redis ──
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Auth (JWT) ──
    JWT_SECRET: str = "jwt-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── NextAuth (used by Next.js frontend) ──
    NEXTAUTH_SECRET: str = ""
    NEXTAUTH_URL: str = "http://localhost:3000"

    # ── OAuth: Google ──
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # ── OAuth: GitHub ──
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # ── OAuth: LinkedIn ──
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""

    OAUTH_REDIRECT_BASE: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:8080"

    # ── AI Providers ──
    GROQ_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    GOOGLE_AI_KEY: str = ""
    XAI_API_KEY: str = ""
    CEREBRAS_API_KEY: str = ""

    # Default AI settings
    DEFAULT_AI_PROVIDER: str = "groq"
    DEFAULT_AI_MODEL: str = "llama-3.3-70b-versatile"
    AI_MODEL: str = "meta-llama/llama-3.3-70b-instruct:free"  # OpenRouter model identifier

    # ── Embeddings ──
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    EMBEDDING_DIMENSION: int = 1536

    # ── Heavy Processing Control ──
    DISABLE_LOCAL_WHISPER: bool = False

    # ── Razorpay ──
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""

    # ── Web Crawling / Scraping (alternative transcript sources) ──
    JINA_API_KEY: str = ""
    FIRECRAWL_API_KEY: str = ""
    SPIDER_API_KEY: str = ""
    CRAWLBASE_API_KEY: str = ""
    SCRAPEDO_API_KEY: str = ""

    # ── Supabase (for migration/legacy or storage) ──
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_PROJECT_ID: str = ""

    # ── S3 / Object Storage ──
    S3_BUCKET_NAME: str = "youtube-genius-uploads"
    S3_REGION: str = "ap-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # ── Cron ──
    CRON_SECRET: str = ""

    # ── Credits ──
    FREE_CREDITS: int = 20
    CREDIT_COST_VIDEO_ANALYSIS: int = 5
    CREDIT_COST_PLAYLIST: int = 20
    CREDIT_COST_CHAT: int = 1
    CREDIT_COST_QUIZ: int = 2
    CREDIT_COST_UPLOAD: int = 10

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
