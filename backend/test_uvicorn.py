import asyncio
from uvicorn import Config, Server

from app.main import app

async def main():
    config = Config(app=app, port=8000, log_level="info")
    server = Server(config=config)
    
    # Run the server for just 10 seconds then shut it down to test startup
    server_task = asyncio.create_task(server.serve())
    await asyncio.sleep(10)
    server.should_exit = True
    await server_task

if __name__ == "__main__":
    asyncio.run(main())
