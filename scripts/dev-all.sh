#!/usr/bin/env bash
# Starts API (with port fallback) and web. API writes its port to .dev-api-port;
# web reads it for NEXT_PUBLIC_API_URL. No manual port killing needed.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Free ports 3000-3005 and 24601-24605 if held (stale from previous dev:all)
for port in 3000 3001 3002 3003 3004 3005 24601 24602 24603 24604 24605; do
  pids=$(lsof -ti :$port 2>/dev/null || true)
  for pid in $pids; do
    if [ -n "$pid" ]; then
      kill $pid 2>/dev/null || true
    fi
  done
done
sleep 2

# Clean stale port file from previous run
rm -f .dev-api-port

# Start API in background; it will try 3001, 3002, ... and write .dev-api-port
npm run dev:api &
API_PID=$!

# Wait for API to write its port (max 30s; API may try many ports first)
for i in $(seq 1 60); do
  if [ -f .dev-api-port ]; then
    break
  fi
  sleep 0.5
done

if [ ! -f .dev-api-port ]; then
  kill $API_PID 2>/dev/null || true
  echo "Error: API did not start in time. Check database and logs."
  exit 1
fi

API_PORT=$(cat .dev-api-port)
export NEXT_PUBLIC_API_URL="http://localhost:${API_PORT}"

# Kill API when this script exits (e.g. Ctrl+C)
trap "kill $API_PID 2>/dev/null || true; rm -f .dev-api-port" EXIT

# Start web on port 3000 (avoids 404 when Next.js falls back to 3006)
cd apps/web && npx next dev -p 3000
