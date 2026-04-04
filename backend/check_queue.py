import asyncio, json
from arq.connections import RedisSettings
from arq import create_pool
from arq.jobs import Job
from app.config import get_settings

async def main():
    settings = get_settings()
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    pool = await create_pool(redis_settings)
    
    from arq.constants import job_key_prefix
    keys = await pool.keys(f"{job_key_prefix}*")
    
    out = []
    for k in keys:
        job_id = k.replace(job_key_prefix, "")
        job = Job(job_id, pool)
        status = await job.status()
        out.append({"id": job_id, "status": str(status)})
        
    with open("queue_status.json", "w") as f:
        json.dump(out, f)
        
    await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
