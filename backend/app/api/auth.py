"""Authentication API routes — OAuth, JWT, email login."""

import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
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
    await db.commit()

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

    user = await _upsert_oauth_user(
        db,
        email=user_info["email"],
        name=user_info.get("name", user_info["email"]),
        avatar_url=user_info.get("picture"),
        provider="google",
        provider_id=user_info["id"],
    )

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

    user = await _upsert_oauth_user(
        db,
        email=primary_email,
        name=user_info.get("name") or user_info.get("login", primary_email),
        avatar_url=user_info.get("avatar_url"),
        provider="github",
        provider_id=str(user_info["id"]),
    )

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

    user = await _upsert_oauth_user(
        db,
        email=email,
        name=name,
        avatar_url=avatar,
        provider="linkedin",
        provider_id=linkedin_id,
    )

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
    if req.settings is not None:
        user.settings = req.settings.model_dump()

    await db.commit()
    await db.refresh(user)
    return user


# ──────────────────────────────────────────────
# SERVER-SIDE OAUTH FLOW (browser-initiated)
# ──────────────────────────────────────────────

from urllib.parse import urlencode
import secrets
from typing import Optional
from fastapi import Request, Response

def _frontend_redirect(user: User, access_token: str, refresh_token: str) -> RedirectResponse:
    """Redirect browser to the frontend with JWT tokens in query params."""
    params = urlencode({
        "token": access_token,
        "refresh_token": refresh_token,
        "name": user.name,
    })
    return RedirectResponse(url=f"{settings.FRONTEND_URL}?{params}")


async def _upsert_oauth_user(
    db: AsyncSession, 
    email: str, 
    name: str, 
    avatar_url: Optional[str], 
    provider: str, 
    provider_id: str
) -> User:
    """Helper to find or create a user from OAuth info."""
    try:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                email=email,
                name=name,
                avatar_url=avatar_url,
                auth_provider=provider,
                auth_provider_id=provider_id,
            )
            db.add(user)
            await db.flush()
            # Initialize credits
            await get_credit_balance(db, user.id)
        else:
            user.name = name or user.name
            user.avatar_url = avatar_url or user.avatar_url
            if provider_id:
                user.auth_provider_id = provider_id
        
        await db.commit()
        await db.refresh(user)
        return user
    except Exception as e:
        await db.rollback()
        print(f"CRITICAL ERROR in _upsert_oauth_user: {str(e)}")
        raise



@router.get("/google/authorize")
async def google_authorize(response: Response):
    """Redirect the browser to Google's OAuth authorization page."""
    state = secrets.token_urlsafe(32)
    response.set_cookie(key="oauth_state", value=state, httponly=True, max_age=600, samesite="lax")
    
    redirect_uri = f"{settings.OAUTH_REDIRECT_BASE}/api/auth/google/callback"
    print(f"DEBUG: Google Redirect URI: {redirect_uri}")
    
    params = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "openid email profile",
        "response_type": "code",
        "access_type": "offline",
        "state": state,
    })
    return RedirectResponse(url=f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback")
async def google_oauth_get_callback(
    request: Request, 
    code: str, 
    state: str, 
    db: AsyncSession = Depends(get_db)
):
    """Handle Google OAuth redirect — exchange code, upsert user, redirect to frontend."""
    try:
        cookie_state = request.cookies.get("oauth_state")
        print(f"DEBUG: Google Callback - State: {state}, Cookie State: {cookie_state}")
        
        # State validation (CSRF Protection)
        if not cookie_state or cookie_state != state:
            print(f"WARNING: CSRF mismatch. Expected {cookie_state}, Got {state}")
            if not settings.DEBUG:
                return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=csrf_detected")

        async with httpx.AsyncClient() as client:
            print("DEBUG: Exchanging code for token...")
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": f"{settings.OAUTH_REDIRECT_BASE}/api/auth/google/callback",
                    "grant_type": "authorization_code",
                },
                timeout=10.0
            )

            if token_resp.status_code != 200:
                print(f"ERROR: Token exchange failed: {token_resp.text}")
                return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=token_exchange_failed")

            tokens = token_resp.json()
            print("DEBUG: Fetching user info...")
            user_resp = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
                timeout=10.0
            )

            if user_resp.status_code != 200:
                print(f"ERROR: User info fetch failed: {user_resp.text}")
                return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=user_info_failed")

            user_info = user_resp.json()
            print(f"DEBUG: Google User email: {user_info.get('email')}")

        # Final DB Upsert
        # Google uses 'id' in v2, but 'sub' in OpenID. We handle both just in case.
        provider_id = user_info.get("id") or user_info.get("sub")
        if not provider_id:
            print(f"ERROR: No provider ID found in user_info: {user_info}")
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=no_user_id")

        user = await _upsert_oauth_user(
            db,
            email=user_info["email"],
            name=user_info.get("name", user_info["email"]),
            avatar_url=user_info.get("picture"),
            provider="google",
            provider_id=str(provider_id),
        )

        response = _frontend_redirect(
            user,
            create_access_token(str(user.id)),
            create_refresh_token(str(user.id)),
        )
        response.delete_cookie("oauth_state")
        return response

    except Exception as e:
        import traceback
        print(f"CRITICAL OAUTH CALLBACK ERROR: {str(e)}")
        print(traceback.format_exc())
        error_msg = str(e).replace(' ', '_')
        return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=server_error&detail={error_msg}")



@router.get("/github/authorize")
async def github_authorize(response: Response):
    """Redirect the browser to GitHub's OAuth authorization page."""
    state = secrets.token_urlsafe(32)
    response.set_cookie(key="oauth_state", value=state, httponly=True, max_age=600, samesite="lax")
    
    params = urlencode({
        "client_id": settings.GITHUB_CLIENT_ID,
        "scope": "user:email",
        "state": state,
    })
    return RedirectResponse(url=f"https://github.com/login/oauth/authorize?{params}")


@router.get("/github/callback")
async def github_oauth_get_callback(request: Request, code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Handle GitHub OAuth redirect — exchange code, upsert user, redirect to frontend."""
    cookie_state = request.cookies.get("oauth_state")
    if not cookie_state or cookie_state != state:
        print(f"WARNING: CSRF mismatch in GitHub OAuth. Expected {cookie_state}, Got {state}")
        if not settings.DEBUG:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=csrf_detected")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )

        if token_resp.status_code != 200:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=oauth_failed")

        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=oauth_failed")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if user_resp.status_code != 200:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=oauth_failed")
        user_info = user_resp.json()

        emails_resp = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if emails_resp.status_code != 200:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=oauth_failed")
        emails = emails_resp.json()
        primary_email = next((e["email"] for e in emails if e.get("primary")), None)

    if not primary_email:
        return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=no_email")

    user = await _upsert_oauth_user(
        db,
        email=primary_email,
        name=user_info.get("name") or user_info.get("login", primary_email),
        avatar_url=user_info.get("avatar_url"),
        provider="github",
        provider_id=str(user_info["id"]),
    )

    response = _frontend_redirect(
        user,
        create_access_token(str(user.id)),
        create_refresh_token(str(user.id)),
    )
    response.delete_cookie("oauth_state")
    return response


@router.get("/linkedin/authorize")
async def linkedin_authorize(response: Response):
    """Redirect the browser to LinkedIn's OAuth authorization page."""
    state = secrets.token_urlsafe(32)
    response.set_cookie(key="oauth_state", value=state, httponly=True, max_age=600, samesite="lax")
    
    redirect_uri = f"{settings.OAUTH_REDIRECT_BASE}/api/auth/linkedin/callback"
    print(f"DEBUG: LinkedIn Redirect URI: {redirect_uri}")
    
    params = urlencode({
        "response_type": "code",
        "client_id": settings.LINKEDIN_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "scope": "openid profile email",
        "state": state,
    })
    return RedirectResponse(url=f"https://www.linkedin.com/oauth/v2/authorization?{params}")


@router.get("/linkedin/callback")
async def linkedin_oauth_get_callback(request: Request, code: str, state: str, db: AsyncSession = Depends(get_db)):
    """Handle LinkedIn OAuth redirect — exchange code, upsert user, redirect to frontend."""
    cookie_state = request.cookies.get("oauth_state")
    if not cookie_state or cookie_state != state:
        print(f"WARNING: CSRF mismatch in LinkedIn OAuth. Expected {cookie_state}, Got {state}")
        if not settings.DEBUG:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=csrf_detected")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.LINKEDIN_CLIENT_ID,
                "client_secret": settings.LINKEDIN_CLIENT_SECRET,
                "redirect_uri": f"{settings.OAUTH_REDIRECT_BASE}/api/auth/linkedin/callback",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_resp.status_code != 200:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=oauth_failed")

        tokens = token_resp.json()
        access_token = tokens.get("access_token")
        if not access_token:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=oauth_failed")

        profile_resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if profile_resp.status_code != 200:
            return RedirectResponse(url=f"{settings.FRONTEND_URL}?error=oauth_failed")

        profile = profile_resp.json()

    user = await _upsert_oauth_user(
        db,
        email=profile.get("email"),
        name=profile.get("name", profile.get("email")),
        avatar_url=profile.get("picture"),
        provider="linkedin",
        provider_id=profile.get("sub", ""),
    )

    response = _frontend_redirect(
        user,
        create_access_token(str(user.id)),
        create_refresh_token(str(user.id)),
    )
    response.delete_cookie("oauth_state")
    return response

