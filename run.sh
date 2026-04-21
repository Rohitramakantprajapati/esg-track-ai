#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting ESG Track backend and frontend..."

cd "$ROOT_DIR/backend"
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

cleanup() {
	kill "$BACKEND_PID" 2>/dev/null || true
}

trap cleanup EXIT

cd "$ROOT_DIR/frontend"
npm install
npm run dev -- --host 0.0.0.0
