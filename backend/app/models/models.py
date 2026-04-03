"""
SQLAlchemy ORM models for the YouTube Genius platform.

Tables:
  - users
  - videos
  - transcripts
  - transcript_chunks (with pgvector embedding)
  - analyses
  - spaces
  - space_videos
  - chat_messages
  - credits
  - credit_transactions
  - subscriptions
  - payments
"""

import uuid
from datetime import datetime, timezone
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import get_settings
from app.database import Base

settings = get_settings()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


# ──────────────────────────────────────────────
# USERS
# ──────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    auth_provider: Mapped[str] = mapped_column(String(50), nullable=False)  # google, github, email
    auth_provider_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # for email auth
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    settings: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=lambda: {"expertise": "intermediate", "theme": "light"})
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    credits: Mapped["Credit"] = relationship(back_populates="user", uselist=False, lazy="selectin")
    spaces: Mapped[list["Space"]] = relationship(back_populates="user", lazy="selectin")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="user", lazy="selectin")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="user", lazy="selectin")
    credit_transactions: Mapped[list["CreditTransaction"]] = relationship(back_populates="user", lazy="selectin")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user", lazy="selectin")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user", lazy="selectin")


# ──────────────────────────────────────────────
# VIDEOS
# ──────────────────────────────────────────────

class Video(Base):
    __tablename__ = "videos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)  # youtube, upload, other
    platform_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)  # YouTube video ID
    url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False, default="Untitled")
    channel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    view_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    like_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    upload_path: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)  # S3 path for uploads
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending"
    )  # pending, processing, ready, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0)
    estimated_remaining_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    transcript: Mapped[Optional["Transcript"]] = relationship(back_populates="video", uselist=False, lazy="selectin")
    transcript_chunks: Mapped[list["TranscriptChunk"]] = relationship(back_populates="video", lazy="selectin")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="video", lazy="selectin")
    space_videos: Mapped[list["SpaceVideo"]] = relationship(back_populates="video", lazy="selectin")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="video", lazy="selectin")

    __table_args__ = (
        Index("ix_videos_platform_id", "platform", "platform_id"),
    )


# ──────────────────────────────────────────────
# TRANSCRIPTS
# ──────────────────────────────────────────────

class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    full_text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # manual_captions, auto_captions, whisper
    word_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    timestamps_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)  # [{start: float, end: float, text: str}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    video: Mapped["Video"] = relationship(back_populates="transcript")


# ──────────────────────────────────────────────
# TRANSCRIPT CHUNKS (with pgvector)
# ──────────────────────────────────────────────

class TranscriptChunk(Base):
    __tablename__ = "transcript_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    start_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    end_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    token_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    video: Mapped["Video"] = relationship(back_populates="transcript_chunks")

    __table_args__ = (
        Index("ix_transcript_chunks_video_idx", "video_id", "chunk_index"),
    )


# ──────────────────────────────────────────────
# ANALYSES (AI-generated content)
# ──────────────────────────────────────────────

class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expertise_level: Mapped[str] = mapped_column(String(30), nullable=False, default="intermediate")
    style: Mapped[str] = mapped_column(String(100), nullable=False, default="detailed")
    ai_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    ai_model: Mapped[str] = mapped_column(String(100), nullable=False)

    # AI Output — stored as structured JSON
    overview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    key_points: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    takeaways: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    timestamps: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    roadmap: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    quiz: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    mind_map: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    flashcards: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    podcast: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    learning_context: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    glossary: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    resources: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    user_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Multi-video synthesis
    is_multi_video: Mapped[bool] = mapped_column(Boolean, default=False)
    related_video_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")
    status_message: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    progress_percentage: Mapped[int] = mapped_column(Integer, default=0)
    estimated_remaining_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    full_analysis: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    video: Mapped["Video"] = relationship(back_populates="analyses")
    user: Mapped["User"] = relationship(back_populates="analyses")


# ──────────────────────────────────────────────
# SPACES (learning collections)
# ──────────────────────────────────────────────

class Space(Base):
    __tablename__ = "spaces"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="spaces")
    space_videos: Mapped[list["SpaceVideo"]] = relationship(back_populates="space", cascade="all, delete-orphan", lazy="selectin")
    space_documents: Mapped[list["SpaceDocument"]] = relationship(back_populates="space", cascade="all, delete-orphan", lazy="selectin")
    space_notes: Mapped[list["Note"]] = relationship(back_populates="space", cascade="all, delete-orphan", lazy="selectin")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(back_populates="space", cascade="all, delete-orphan", lazy="selectin")


class SpaceVideo(Base):
    __tablename__ = "space_videos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    space_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False
    )
    video_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=False
    )
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    space: Mapped["Space"] = relationship(back_populates="space_videos")
    video: Mapped["Video"] = relationship(back_populates="space_videos", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("space_id", "video_id", name="uq_space_video"),
    )


# ──────────────────────────────────────────────
# DOCUMENTS
# ──────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1024), nullable=False)  # S3 or local path
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # pdf, docx, txt
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending")  # pending, processing, ready, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="document", cascade="all, delete-orphan", lazy="selectin")
    space_documents: Mapped[list["SpaceDocument"]] = relationship(back_populates="document", cascade="all, delete-orphan", lazy="selectin")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding = mapped_column(Vector(settings.EMBEDDING_DIMENSION), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_document_chunks_doc_idx", "document_id", "chunk_index"),
    )


class SpaceDocument(Base):
    __tablename__ = "space_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    space_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    space: Mapped["Space"] = relationship(back_populates="space_documents")
    document: Mapped["Document"] = relationship(back_populates="space_documents", lazy="selectin")

    __table_args__ = (
        UniqueConstraint("space_id", "document_id", name="uq_space_document"),
    )


# ──────────────────────────────────────────────
# NOTES
# ──────────────────────────────────────────────

class Note(Base):
    __tablename__ = "notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    space_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled Note")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    space: Mapped[Optional["Space"]] = relationship(back_populates="space_notes")


# ──────────────────────────────────────────────
# CHAT MESSAGES (RAG history)
# ──────────────────────────────────────────────

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    video_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("videos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    space_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("spaces.id", ondelete="CASCADE"), nullable=True, index=True
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user, assistant
    content: Mapped[str] = mapped_column(Text, nullable=False)
    context_chunks: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # chunk IDs used for RAG
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="chat_messages")
    video: Mapped[Optional["Video"]] = relationship(back_populates="chat_messages")
    space: Mapped[Optional["Space"]] = relationship(back_populates="chat_messages")


# ──────────────────────────────────────────────
# CREDITS
# ──────────────────────────────────────────────

class Credit(Base):
    __tablename__ = "credits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_earned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_spent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="credits")


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # positive=credit, negative=debit
    operation: Mapped[str] = mapped_column(String(100), nullable=False)  # video_analysis, chat, purchase, signup_bonus
    reference_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # analysis_id, payment_id, etc.
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="credit_transactions")


# ──────────────────────────────────────────────
# SUBSCRIPTIONS
# ──────────────────────────────────────────────

class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    plan: Mapped[str] = mapped_column(String(50), nullable=False)  # free, starter, pro
    credits_included: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")  # active, expired, cancelled
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    razorpay_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="subscriptions")


# ──────────────────────────────────────────────
# PAYMENTS (Razorpay records)
# ──────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=new_uuid
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    razorpay_order_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    razorpay_signature: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)  # in paise (INR * 100)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="INR")
    plan: Mapped[str] = mapped_column(String(50), nullable=False)
    credits_purchased: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="created"
    )  # created, authorized, captured, failed, refunded
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="payments")
