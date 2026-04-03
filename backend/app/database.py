"""Async SQLAlchemy database engine and session factory."""

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ── Redis Connection Pool ──
_redis_pool = None
_redis_client = None


async def init_redis_pool() -> None:
    """Initialize Redis connection pool."""
    global _redis_pool, _redis_client
    try:
        print(f"DEBUG: Initializing Redis pool with URL: {settings.REDIS_URL[:20]}...")
        _redis_pool = redis.ConnectionPool.from_url(
            settings.REDIS_URL,
            max_connections=50,
            decode_responses=True,
        )
        _redis_client = redis.Redis(connection_pool=_redis_pool)
        # Test connection
        await _redis_client.ping()
        print("DEBUG: Redis connected successfully.")
    except Exception as e:
        print(f"ERROR: Failed to initialize Redis: {str(e)}")
        # In production, we might want to continue without Redis if it's optional,
        # but here it's likely required for background tasks/ARQ.
        raise


async def get_redis() -> redis.Redis:
    """Get Redis client from pool."""
    global _redis_client
    if _redis_client is None:
        await init_redis_pool()
    return _redis_client


async def close_redis_pool() -> None:
    """Close Redis connection pool."""
    global _redis_pool, _redis_client
    try:
        if _redis_client:
            await _redis_client.close()
        if _redis_pool:
            await _redis_pool.disconnect()
        print("DEBUG: Redis pool closed.")
    except Exception as e:
        print(f"ERROR: Failed to close Redis pool: {str(e)}")



class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
