#!/usr/bin/env bash
# Restore app when 404 or broken/unstyled UI. Clears caches, rebuilds, and starts production.
set -e
cd "$(dirname "$0")/.."
echo "Stopping any existing dev processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "tsx watch src/index" 2>/dev/null || true
sleep 2
echo "Clearing Next.js and build caches..."
rm -rf apps/web/.next
rm -rf apps/web/node_modules/.cache 2>/dev/null || true
echo "Building web app..."
cd apps/web && npm run build
cd ../..
echo ""
echo "UI restored. To run with full styling:"
echo "  npm run start:web"
echo "  Open: http://localhost:3000"
echo ""
echo "Note: Production (start:web) is reliable. Dev mode may show 404 when"
echo "EMFILE/port conflicts occur; use production for a stable UI."
