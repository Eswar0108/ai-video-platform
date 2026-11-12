#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "=============================================================="
echo "🚀 Starting AI Training Video Collection Platform (Local Demo)"
echo "=============================================================="

# 1. Generate sample 5-minute video if not present
if [ ! -f "$DIR/sample_5min.mp4" ]; then
    echo "🎬 Generating 5-minute 1080p sample video for drag-and-drop testing..."
    python3 "$DIR/scripts/generate_test_video.py" --duration 300 --output "$DIR/sample_5min.mp4"
fi

# 2. Check and Seed Database
echo "🌱 Checking and seeding database..."
(cd "$DIR/backend" && source venv/bin/activate && python3 -m app.seed)

# 3. Start Backend
echo "📡 Starting FastAPI Backend on http://localhost:8000..."
(cd "$DIR/backend" && source venv/bin/activate && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

# 4. Start Frontend
echo "💻 Starting Next.js Web Application on http://localhost:3000..."
(cd "$DIR/frontend-web" && exec npm run dev -- -p 3000) &
FRONTEND_PID=$!

# Clean shutdown function
cleanup() {
    echo ""
    echo "🛑 Shutting down AI Video Platform demo services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID 2>/dev/null || true
    wait $FRONTEND_PID 2>/dev/null || true
    echo "✅ All services stopped."
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "=============================================================="
echo "🎉 AI Video Platform is LIVE!"
echo "   Worker Portal:       http://localhost:3000/worker"
echo "   Admin Reviewer UI:   http://localhost:3000/admin/review"
echo "   Backend Swagger API: http://localhost:8000/docs"
echo ""
echo "   Default Accounts:"
echo "   - Admin:  admin@example.com  / admin123"
echo "   - Worker: worker@example.com / worker123"
echo ""
echo "   Test Video for Upload: $DIR/sample_5min.mp4"
echo "=============================================================="
echo "Press Ctrl+C to stop all services."

# Wait for children
wait

