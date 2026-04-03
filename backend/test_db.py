import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import sys

# Convert the standard postgresql scheme to use the asyncpg driver
db_url = "postgresql+asyncpg://postgres.skblfvjppuxqvplnjlcs:khhqLbtAwe9DGpwC@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"

async def test_connection():
    try:
        print(f"Connecting to {db_url}...")
        engine = create_async_engine(db_url, echo=False)
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT version();"))
            row = result.fetchone()
            print("Successfully connected!")
            print(f"Database version: {row[0]}")
        await engine.dispose()
        sys.exit(0)
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(test_connection())
