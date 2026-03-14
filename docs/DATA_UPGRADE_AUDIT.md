# Data Upgrade Risk Audit

This document records upgrade and data-loss risks identified in the codebase and how they are addressed.

## Identified Risks

### 1. Seed in Production

**Risk**: Running `npm run db:seed` in production could:
- Overwrite admin/test user passwords (upsert by email)
- Update module/lesson content and deactivate lessons not in seed
- Create RAGChunk records (additive, low risk)

**Mitigation**: Seed now checks `NODE_ENV`. If `production`, it exits unless `ALLOW_SEED_IN_PRODUCTION=1`. See `apps/api/prisma/seed.ts`.

### 2. ingest-legal-library.ts

**Risk**: Deletes all RAGChunk records for SOURCE_REGISTRY sources before re-ingesting. Running in production without backup would wipe the legal reference library.

**Mitigation**: Script now requires `CONFIRM_LEGAL_INGEST=1` when `NODE_ENV=production`. Documented in `apps/api/scripts/README-DEPLOY.md`.

### 3. prisma migrate reset

**Risk**: `prisma migrate reset` drops the database and recreates it. Never use in production.

**Mitigation**: Documented in UPGRADE_RUNBOOK.md and DEPLOY_CHECKLIST.md. Production uses `prisma migrate deploy` only.

### 4. Destructive Migrations

**Risk**: Migrations that drop columns or tables without preserving data.

**Mitigation**: UPGRADE_RULES.md requires additive-first approach. Existing migration `document_category_to_string` is a good example: add new column, copy data, drop old, rename.

### 5. Case Deletion Cascade

**Risk**: Deleting a case cascades to documents, compile jobs, document builder state, etc. Files in `uploads/documents/{caseId}` and compile artifacts are also deleted.

**Status**: Intentional. User must confirm. No change needed.

### 6. Compile Artifact / Audit Report Format

**Risk**: Future changes to `optionsHash` or `savedAuditReport` structure could break reading of old artifacts.

**Mitigation**: Added `artifactSchemaVersion` to compile artifact optionsHash. Reader uses `existingMeta.artifactSchemaVersion ?? existingMeta.version ?? 1`. Future readers can branch on version.

### 7. Document Storage Paths

**Risk**: Relocation of `uploads/` or path changes could orphan files.

**Status**: Paths are centralized in `apps/api/src/services/documents/storage.ts`. Backup script includes `uploads/`.

### 8. No Production Migration Command

**Risk**: Using `prisma migrate dev` in production (creates new migrations, can prompt).

**Mitigation**: Added `db:migrate:deploy` which runs `prisma migrate deploy` — applies pending migrations only, no prompts.

---

## What Is NOT at Risk

- **User accounts**: Seed only upserts specific test emails; does not touch other users.
- **Cases, documents, compile jobs**: Seed does not touch these.
- **DocumentBuilderState**: Seed does not touch these.
- **EER, PetitionPackage, etc.**: Seed does not touch these.
- **RAGChunk from seed**: Seed only creates if not exists; does not delete. ingest-legal-library is a separate script.
