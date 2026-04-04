import asyncio
import httpx
from app.main import app

async def main():
    from app.middleware.auth import get_current_user
    from app.models.models import User
    from app.database import async_session_factory
    from sqlalchemy import select
    
    async with async_session_factory() as db:
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        
    app.dependency_overrides[get_current_user] = lambda: user
    
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "urls": ["https://www.youtube.com/watch?v=dQw4w9WgXcQ"],
            "expertise": "intermediate",
            "style": "detailed",
            "language": "English",
            "full_analysis": False
        }
        
        try:
            response = await client.post("/api/videos/analyze", json=payload)
            print("STATUS:", response.status_code)
        except Exception as e:
            if hasattr(e, 'orig'):
                print("ORIG_EXC_MSG:", str(e.orig))
            else:
                print("NORM_EXC_MSG:", str(e))

if __name__ == "__main__":
    asyncio.run(main())
