#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting VidCrunch Unified Backend (API + Worker)..."

# 1. Run migrations
echo "⚙️ Running database migrations..."
python -m alembic upgrade head

# 2. Start arq worker in the background
echo "👷 Starting background worker..."
arq app.workers.tasks.WorkerSettings &

# 3. Start FastAPI server in the foreground
echo "🌐 Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 2
