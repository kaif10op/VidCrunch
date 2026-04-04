import asyncio
import httpx
from app.config import get_settings
from app.api.auth import create_access_token
from app.database import async_session_factory
from app.models.models import User
from sqlalchemy import select

async def main():
    async with async_session_factory() as db:
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        
    if not user:
        print("No user found locally to impersonate.")
        return

    # Use the local JWT_SECRET from .env to generate a token
    token = create_access_token({"sub": str(user.id)})
    
    payload = {
        "urls": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
        "expertise": "intermediate",
        "style": "detailed",
        "language": "English",
        "full_analysis": False
    }
    
    print(f"Connecting to remote Render instance as user {user.id}...")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://vidcrunch.onrender.com/api/videos/analyze", 
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30.0
        )
        print("STATUS:", response.status_code)
        try:
            print("BODY:", response.json())
        except Exception:
            print("TEXT:", response.text)

if __name__ == "__main__":
    asyncio.run(main())
