# Deploy Checklist

Use this checklist before and after each production deployment.

---

## Pre-Deploy

### 1. Backup

- [ ] **Database**: Run `pg_dump` or equivalent
  ```bash
  pg_dump -h localhost -U postgres aipas > backup_$(date +%Y%m%d_%H%M%S).sql
  ```
  Or use `./apps/api/scripts/backup-before-deploy.sh` if configured.
- [ ] **File storage**: Backup `uploads/` directory
  - `uploads/documents/` — user-uploaded documents
  - `uploads/compile/` — compiled packet PDFs
- [ ] **Verify backup**: Restore to a test DB and confirm data is readable.

### 2. Migrations

- [ ] **Pending migrations**: List with `npx prisma migrate status`
- [ ] **Run migrations**: `npm run db:migrate:deploy` (production)
- [ ] **No migration failures**: If any fail, **stop** and restore from backup.

### 3. Feature flags

- [ ] **New features**: Ensure `FEATURE_*` vars are set as intended (disabled by default for new work).
- [ ] **No accidental enables**: Unfinished features should remain off.

### 4. Environment

- [ ] **DATABASE_URL**: Points to production DB.
- [ ] **JWT_SECRET**: Strong and unique.
- [ ] **OPENAI_API_KEY**: Valid if AI features are used.

---

## Post-Deploy

### 1. Health checks

- [ ] **API**: `GET /api/health` or equivalent returns 200.
- [ ] **Web**: App loads and login works.

### 2. Data verification

- [ ] **User count**: Confirm user table has expected rows.
- [ ] **Case count**: At least one case exists (or zero if fresh).
- [ ] **Documents**: Spot-check a document can be opened.
- [ ] **Compile**: If a case had a compiled packet, verify it can be downloaded.
- [ ] **Packet review**: If a case had a saved audit report, verify it loads.

### 3. High-risk pages/features

- [ ] **Case list**: `/case` loads.
- [ ] **Case detail**: `/case/[id]` loads for a known case.
- [ ] **Documents**: Upload and view a document.
- [ ] **Document builder**: Open a builder state, verify draft loads.
- [ ] **Compile**: Start a compile job, poll status, download artifact.
- [ ] **Packet review**: Run packet review, save report, verify it persists.
- [ ] **Advisor chat**: Send a message, verify response.

### 4. Rollback

- [ ] **Rollback plan**: If critical issues found, revert to previous deployment.
- [ ] **Database rollback**: If migration caused issues, restore from backup. Do **not** run `prisma migrate reset`.

---

## What Must Be Backed Up Before Release

| Asset | Location | Notes |
|-------|----------|-------|
| PostgreSQL database | `DATABASE_URL` | Full dump of `aipas` database |
| User documents | `uploads/documents/{caseId}/` | Per-case folders |
| Compile artifacts | `uploads/compile/` | PDF outputs |
| Environment | `.env` (production) | Secrets, feature flags |

---

## Rollback Guidance

1. **Revert application** to previous version.
2. **If migration was applied**: Restore database from backup. Re-run migrations from the previous app version if needed.
3. **If file storage was modified**: Restore `uploads/` from backup.
4. **Verify** rollback: health checks, spot-check data.
