# Deploy Scripts

## backup-before-deploy.sh

**Purpose**: Backup database and uploads before production deployment.

**Usage**:
```bash
./apps/api/scripts/backup-before-deploy.sh [backup-dir]
# Or from repo root:
npm run db:backup
```

**Requires**: `DATABASE_URL` in `apps/api/.env` for database backup. `pg_dump` must be available.

**Output**: `backups/<timestamp>/` with:
- `database.sql` — PostgreSQL dump
- `uploads.tar.gz` — uploads directory
- `backup_manifest.txt` — metadata

---

## ingest-legal-library.ts

**Purpose**: Ingest PDFs from `legal-library/` into RAGChunk table for packet review and advisor chat.

**Warning**: This script **deletes** existing RAGChunk records for the registered sources before re-ingesting. Do not run in production without:
1. Database backup
2. `CONFIRM_LEGAL_INGEST=1` (when NODE_ENV=production)

**Usage**:
```bash
npx tsx apps/api/scripts/ingest-legal-library.ts
```

---

## Seed

See `docs/UPGRADE_RUNBOOK.md` — seed is blocked in production unless `ALLOW_SEED_IN_PRODUCTION=1`.
