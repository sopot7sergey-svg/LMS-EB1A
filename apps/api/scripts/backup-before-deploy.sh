#!/usr/bin/env bash
# Backup script for pre-deploy safety.
# Run before production deployments to preserve user data.
#
# Usage: ./apps/api/scripts/backup-before-deploy.sh [backup-dir]
# Default backup dir: ./backups (relative to repo root)

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${1:-$REPO_ROOT/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="$BACKUP_DIR/$TIMESTAMP"

mkdir -p "$BACKUP_SUBDIR"
echo "Backup directory: $BACKUP_SUBDIR"

# Load .env if present
if [ -f "$REPO_ROOT/apps/api/.env" ]; then
  set -a
  source "$REPO_ROOT/apps/api/.env" 2>/dev/null || true
  set +a
fi

# 1. Database backup (PostgreSQL)
if [ -n "$DATABASE_URL" ]; then
  echo "Backing up database..."
  DB_BACKUP="$BACKUP_SUBDIR/database.sql"
  # Extract connection params; pg_dump accepts postgres:// URLs
  if pg_dump "$DATABASE_URL" > "$DB_BACKUP" 2>/dev/null; then
    echo "  Database backup: $DB_BACKUP ($(du -h "$DB_BACKUP" | cut -f1))"
  else
    echo "  WARNING: pg_dump failed. Install PostgreSQL client and ensure DATABASE_URL is correct."
  fi
else
  echo "  SKIP: DATABASE_URL not set"
fi

# 2. File storage backup (uploads)
UPLOADS="$REPO_ROOT/uploads"
if [ -d "$UPLOADS" ]; then
  echo "Backing up uploads..."
  UPLOADS_BACKUP="$BACKUP_SUBDIR/uploads.tar.gz"
  tar -czf "$UPLOADS_BACKUP" -C "$REPO_ROOT" uploads 2>/dev/null || true
  if [ -f "$UPLOADS_BACKUP" ]; then
    echo "  Uploads backup: $UPLOADS_BACKUP ($(du -h "$UPLOADS_BACKUP" | cut -f1))"
  else
    echo "  WARNING: Could not create uploads archive"
  fi
else
  echo "  SKIP: uploads/ not found (may be in different path in production)"
fi

# 3. Env snapshot (no secrets - just a note)
echo "Backup completed at $(date -Iseconds)" > "$BACKUP_SUBDIR/backup_manifest.txt"
echo "DATABASE_URL set: ${DATABASE_URL:+yes}" >> "$BACKUP_SUBDIR/backup_manifest.txt"
echo "UPLOADS backed up: $([ -f "${UPLOADS_BACKUP:-}" ] && echo yes || echo no)" >> "$BACKUP_SUBDIR/backup_manifest.txt"

echo ""
echo "=== Backup complete ==="
echo "Location: $BACKUP_SUBDIR"
echo ""
echo "To restore database: psql \$DATABASE_URL < $BACKUP_SUBDIR/database.sql"
echo "To restore uploads:  tar -xzf $BACKUP_SUBDIR/uploads.tar.gz -C $REPO_ROOT"
echo ""
