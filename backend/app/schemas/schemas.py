"""Pydantic schemas for API request/response validation."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, HttpUrl


# ──────────────────────────────────────────────
# AUTH
# ──────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class CreditBalanceResponse(BaseModel):
    balance: int
    total_earned: int
    total_spent: int


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    avatar_url: Optional[str] = None
    auth_provider: str
    is_active: bool
    created_at: datetime
    credits: Optional[CreditBalanceResponse] = None

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    name: str = Field(min_length=1, max_length=255)


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    avatar_url: Optional[str] = None


class OAuthCallbackRequest(BaseModel):
    code: str
    state: Optional[str] = None


# ──────────────────────────────────────────────
# VIDEOS
# ──────────────────────────────────────────────

class VideoAnalyzeRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=5)
    expertise: str = Field(default="intermediate", pattern="^(beginner|intermediate|expert)$")
    style: str = Field(default="detailed", max_length=2000)
    language: str = Field(default="English", max_length=50)
    full_analysis: bool = Field(default=False)


class VideoResponse(BaseModel):
    id: UUID
    platform: str
    platform_id: Optional[str] = None
    url: Optional[str] = None
    title: str
    channel: Optional[str] = None
    duration_seconds: Optional[int] = None
    thumbnail_url: Optional[str] = None
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    status: str
    progress_percentage: int = 0
    estimated_remaining_seconds: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class VideoUploadResponse(BaseModel):
    id: UUID
    title: str
    status: str
    message: str


# ──────────────────────────────────────────────
# ANALYSIS
# ──────────────────────────────────────────────

class AnalysisResponse(BaseModel):
    id: UUID
    video_id: UUID
    video_platform_id: Optional[str] = None
    video_title: Optional[str] = None
    video_thumbnail: Optional[str] = None
    expertise_level: str
    style: str
    ai_provider: str
    ai_model: str
    overview: Optional[str] = None
    key_points: Optional[list] = None
    takeaways: Optional[list] = None
    timestamps: Optional[list] = None
    roadmap: Optional[dict] = None
    quiz: Optional[list] = None
    mind_map: Optional[dict] = None
    flashcards: Optional[list] = None
    learning_context: Optional[dict] = None
    tags: Optional[list] = None
    transcript_segments: Optional[list] = None
    is_multi_video: bool = False
    status: str
    progress_percentage: int = 0
    estimated_remaining_seconds: Optional[int] = None
    full_analysis: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisDetailResponse(BaseModel):
    analysis: AnalysisResponse
    video: VideoResponse
    transcript_text: Optional[str] = None
    transcript_segments: Optional[list] = None


# ──────────────────────────────────────────────
# CHAT
# ──────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    context_snippet: Optional[str] = None


class ChatMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    answer: str
    sources: Optional[list[dict]] = None  # chunk references used for the answer


# ──────────────────────────────────────────────
# SPACES
# ──────────────────────────────────────────────

class SpaceCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None


class SpaceUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None


class SpaceResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_public: bool
    video_count: int = 0
    video_ids: Optional[list[UUID]] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SpaceAddVideoRequest(BaseModel):
    video_id: UUID


# ──────────────────────────────────────────────
# CREDITS
# ──────────────────────────────────────────────

# CREDITS Moved Up


class CreditTransactionResponse(BaseModel):
    id: UUID
    amount: int
    operation: str
    reference_id: Optional[str] = None
    balance_after: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# PAYMENTS
# ──────────────────────────────────────────────

class CreateOrderRequest(BaseModel):
    plan: str = Field(pattern="^(starter|pro)$")


class CreateOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    plan: str
    credits: int


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class PaymentResponse(BaseModel):
    id: UUID
    razorpay_order_id: str
    amount_paise: int
    plan: str
    credits_purchased: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# EXPORT
# ──────────────────────────────────────────────

class ExportRequest(BaseModel):
    analysis_id: UUID
    format: str = Field(pattern="^(pdf|markdown|json|notion)$")


# ──────────────────────────────────────────────
# GENERIC
# ──────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
