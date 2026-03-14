# Upgrade Safety Rules

These rules govern how schema changes, migrations, seeds, and deployments must be done to preserve user data.

## A. No Destructive Schema Changes by Default

- **No dropping columns or tables** without an explicit migration plan and backup.
- **No reset-style behavior** in production (e.g. `prisma migrate reset`).
- **No automatic reseeding** that disables or overwrites live user data.
- When removing a column: prefer deprecation (add new, migrate data, then remove in a later release) over immediate drop.

## B. Backward-Compatible Data Evolution

- **Prefer additive changes**: new columns, new tables, new enums.
- **Prefer nullable fields** over destructive replacements when evolving schemas.
- **Prefer migrations that preserve legacy data** and map it forward (e.g. `document_category_to_string` migration).
- Avoid changing types of existing columns in ways that lose data.

## C. Explicit Migration Path

- **Schema changes must use Prisma migrations** (`prisma migrate dev` for dev, `prisma migrate deploy` for production).
- **Data transformations** must be version-aware when reading older persisted formats.
- **App startup must not silently mutate or discard old records.**
- Never run `prisma migrate reset` against a production database.

## D. Seed and Reset Isolation

- **Seed is for development only.** It must not run as part of production deploy.
- **Production initialization** (if any) must be separate from dev seed and must not overwrite user data.
- See `apps/api/prisma/seed.ts` — it now checks `NODE_ENV` and `ALLOW_SEED_IN_PRODUCTION`.

## E. Script Safety

- **ingest-legal-library.ts** deletes RAGChunk records for known sources before re-ingesting. Run only when intentionally refreshing the legal library. Do not run against production without backup.
- **Backup before running any script** that modifies or deletes data.

## F. Feature Rollout

- Use `FEATURE_*` environment variables for gated features.
- Unfinished features should be disabled by default.
- See `docs/FEATURE_FLAGS.md` for the mechanism.
