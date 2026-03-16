"""Authentication API routes — OAuth, JWT, email login."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import bcrypt
import httpx

from app.config import get_settings
from app.database import get_db
from app.models.models import User, Credit
from app.schemas.schemas import (
    LoginRequest,
    OAuthCallbackRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    MessageResponse,
    UserUpdateRequest,
)
from app.middleware.auth import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    decode_token,
)
from app.services.credit_service import get_credit_balance

router = APIRouter()
settings = get_settings()

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        return False


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register with email and password."""
    # Check if email exists
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=req.email,
        name=req.name,
        auth_provider="email",
        hashed_password=get_password_hash(req.password),
    )
    db.add(user)
    await db.flush()

    # Initialize credits
    await get_credit_balance(db, user.id)

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/google/callback", response_model=TokenResponse)
async def google_oauth_callback(req: OAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth callback — exchange code for user info."""
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": req.code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{settings.OAUTH_REDIRECT_BASE}/api/auth/google/callback",
                "grant_type": "authorization_code",
            },
        )

        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange OAuth code")

        tokens = token_resp.json()

        # Get user info
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )

        if user_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        user_info = user_resp.json()

    # Find or create user
    result = await db.execute(select(User).where(User.email == user_info["email"]))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=user_info["email"],
            name=user_info.get("name", user_info["email"]),
            avatar_url=user_info.get("picture"),
            auth_provider="google",
            auth_provider_id=user_info["id"],
        )
        db.add(user)
        await db.flush()
        await get_credit_balance(db, user.id)
    else:
        # Update avatar on each login
        user.avatar_url = user_info.get("picture", user.avatar_url)

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/github/callback", response_model=TokenResponse)
async def github_oauth_callback(req: OAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    """Handle GitHub OAuth callback."""
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": req.code,
            },
            headers={"Accept": "application/json"},
        )

        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange OAuth code")

        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token received")

        # Get user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_info = user_resp.json()

        # Get primary email
        emails_resp = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        emails = emails_resp.json()
        primary_email = next((e["email"] for e in emails if e.get("primary")), None)

    if not primary_email:
        raise HTTPException(status_code=400, detail="No primary email on GitHub account")

    result = await db.execute(select(User).where(User.email == primary_email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=primary_email,
            name=user_info.get("name") or user_info.get("login", primary_email),
            avatar_url=user_info.get("avatar_url"),
            auth_provider="github",
            auth_provider_id=str(user_info["id"]),
        )
        db.add(user)
        await db.flush()
        await get_credit_balance(db, user.id)

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/linkedin/callback", response_model=TokenResponse)
async def linkedin_oauth_callback(req: OAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    """Handle LinkedIn OAuth callback."""
    async with httpx.AsyncClient() as client:
        # Exchange code for access token
        token_resp = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": req.code,
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                "redirect_uri": f"{settings.OAUTH_REDIRECT_BASE}/api/auth/linkedin/callback",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange LinkedIn OAuth code")

        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="No access token from LinkedIn")

        # Get user profile
        profile_resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if profile_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to get LinkedIn profile")

        profile = profile_resp.json()

    email = profile.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="No email on LinkedIn account")

    name = profile.get("name", email)
    avatar = profile.get("picture")
    linkedin_id = profile.get("sub", "")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=name,
            avatar_url=avatar,
            auth_provider="linkedin",
            auth_provider_id=linkedin_id,
        )
        db.add(user)
        await db.flush()
        await get_credit_balance(db, user.id)
    else:
        user.avatar_url = avatar or user.avatar_url

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token: str, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile."""
    return user


@router.patch("/me", response_model=UserResponse)
async def patch_me(
    req: UserUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile."""
    if req.name is not None:
        user.name = req.name
    if req.avatar_url is not None:
        user.avatar_url = req.avatar_url

    await db.commit()
    await db.refresh(user)
    return user

