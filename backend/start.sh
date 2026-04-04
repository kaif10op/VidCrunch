#!/bin/bash

echo "🚀 Starting VidCrunch Unified Backend (API + Worker)..."

# 1. Run migrations (gracefully falling back if it fails due to asyncpg connection strings)
echo "⚙️ Running database migrations..."
python -m alembic upgrade head || echo "⚠️ Migrations skipped or failed (safe to ignore if db is synced)"

# 2. Start arq worker in the background
echo "👷 Starting background worker..."
arq app.workers.tasks.WorkerSettings &

# 3. Start FastAPI server in the foreground
echo "🌐 Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
