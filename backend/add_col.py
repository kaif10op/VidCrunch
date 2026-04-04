import asyncio
from sqlalchemy import text
from app.database import async_session_factory

async def main():
    async with async_session_factory() as db:
        await db.execute(text("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS status_message VARCHAR(255);"))
        await db.commit()
        print("Successfully added status_message column to analyses table!")

asyncio.run(main())
