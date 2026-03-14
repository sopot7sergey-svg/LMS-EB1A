#!/usr/bin/env bash
# Restore dev app when 404 or broken UI. Clears Next.js cache and restarts.
set -e
cd "$(dirname "$0")/.."
echo "Stopping any existing dev processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "tsx watch src/index" 2>/dev/null || true
sleep 2
echo "Clearing Next.js cache..."
rm -rf apps/web/.next
echo "Done. Run: npm run dev:all"
echo "Then open http://localhost:3000 (web) and http://localhost:3001 (API)"
