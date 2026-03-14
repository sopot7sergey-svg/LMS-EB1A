# Upgrade Runbook

How to deploy new versions safely, run migrations, avoid data loss, and add future features without breaking prior user records.

## Prerequisites

- Database backup completed (see [Backup Before Deploy](#backup-before-deploy))
- Migrations tested locally or in staging
- No destructive schema changes without explicit approval

---

## 1. How to Deploy Safely

### 1.1 Pre-deploy checklist

1. **Backup**: Run `./apps/api/scripts/backup-before-deploy.sh` (or equivalent).
2. **Verify migrations**: Run `npm run db:migrate:deploy` in a dry run or staging first.
3. **Feature flags**: Ensure any new features are disabled by default (`FEATURE_*` unset).
4. **Stop or drain**: If possible, pause or drain traffic during migration (optional for additive migrations).

### 1.2 Deploy sequence

1. Deploy new application code.
2. Run migrations: `npm run db:migrate:deploy` (uses `prisma migrate deploy` for production).
3. Restart application.
4. Run post-deploy verification (see [Post-Deploy Verification](#post-deploy-verification)).

### 1.3 Rollback

- **If migration fails**: Restore database from backup. Do not run `prisma migrate reset`.
- **If app fails after deploy**: Revert to previous deployment. Migrations are backward-compatible where possible; old app may still work with new schema if changes were additive.
- **If data corruption suspected**: Restore from backup. Investigate and fix migration before re-deploying.

---

## 2. How to Run Migrations Safely

### 2.1 Development

```bash
cd apps/api
npm run db:migrate   # prisma migrate dev — creates new migrations, applies them
```

### 2.2 Production

```bash
cd apps/api
npm run db:migrate:deploy   # prisma migrate deploy — applies pending migrations only
```

**Never use** `prisma migrate reset` in production. It drops the database and recreates it.

### 2.3 Migration best practices

- **Additive first**: Add new columns as nullable, backfill, then make required if needed.
- **Data-preserving**: When changing types (e.g. enum → string), use a multi-step migration: add new column, copy/map data, drop old, rename.
- **Test in staging**: Run migrations against a copy of production data before production deploy.

---

## 3. How to Avoid Data Loss

- **Never run seed in production** unless explicitly intended (see [Seed Isolation](#seed-isolation)).
- **Never run** `ingest-legal-library.ts` against production without backup — it deletes RAGChunk records for known sources.
- **Never run** `prisma migrate reset` against a production database.
- **Never run** `prisma db push` in production — use migrations only.
- **Case deletion** is intentional: deleting a case cascades to documents, compile jobs, etc. Ensure users confirm before delete.

---

## 4. How to Treat Production vs Dev Data

| Environment | Seed | Migrations | Backup |
|-------------|------|------------|--------|
| Development | `npm run db:seed` | `prisma migrate dev` | Optional |
| Staging | Optional (separate seed if needed) | `prisma migrate deploy` | Before deploy |
| Production | **Never** (unless `ALLOW_SEED_IN_PRODUCTION=1` and explicit) | `prisma migrate deploy` | **Required** before deploy |

---

## 5. How to Add Future Features Without Breaking Prior Records

- **Schema changes**: Add new columns/tables; avoid removing or renaming existing ones without a migration plan.
- **JSON fields** (e.g. `metadata`, `optionsHash`, `draftJson`): Add version fields or version keys in the JSON. When reading, check version and handle legacy formats.
- **Feature flags**: Gate new behavior behind `FEATURE_*` env vars. Default to disabled.
- **Backward compatibility**: If old app versions persist data in a format, new app must still read it when possible.

---

## 6. Backup Before Deploy

See `apps/api/scripts/backup-before-deploy.sh` (or `docs/DEPLOY_CHECKLIST.md`) for full backup/restore steps.

**Minimum before deploy:**

- PostgreSQL dump (all tables)
- `uploads/` directory (documents + compile artifacts)

---

## 7. Seed Isolation

- **Default**: Seed refuses to run when `NODE_ENV=production` unless `ALLOW_SEED_IN_PRODUCTION=1` is set.
- **Production seed**: Only use for initial bootstrap (e.g. first deploy). Never use for "refreshing" data that could overwrite user content.
- **Dev seed**: Safe to run repeatedly. Uses upsert for users/modules; does not touch cases, documents, or user-generated content.
