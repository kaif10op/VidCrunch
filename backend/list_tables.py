import asyncio
from sqlalchemy import text
from app.database import async_session_factory

async def main():
    async with async_session_factory() as db:
        res = await db.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [r[0] for r in res.fetchall()]
        print("TABLES:", tables)

asyncio.run(main())
