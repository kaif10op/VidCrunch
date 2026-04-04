import asyncio
from sqlalchemy import text
from app.database import async_session_factory

async def main():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='analyses'"))
        columns = [r[0] for r in res.fetchall()]
        print("COLUMNS:", columns)

asyncio.run(main())
