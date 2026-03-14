# LMS EB-1A

AI-assisted course to build a submission-ready EB-1A I-140 petition package.

## Quick Start

### Easiest: run both web + API in one terminal

```bash
npm run dev:all
```

Starts the API (port 3001) and web app (port 3000 or next available). Open the URL shown in the terminal.

### Or use two terminals

**Terminal 1 – API** (requires PostgreSQL + `apps/api/.env` with `DATABASE_URL`):
```bash
npm run dev:api
```

**Terminal 2 – Web:**
```bash
npm run dev:web
```

- **My Cases:** `/case`
- **Login:** `/login`

### Full stack via Turbo

```bash
npm run dev
```

Runs web + API via Turbo. Requires PostgreSQL.

## Environment

**`apps/web/.env.local`** – Required for document viewing:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Without this, opening documents will fail. Copy from `apps/web/.env.example` if needed.

## If login shows "Failed to fetch"

1. **API not running:** Use `npm run dev:all` (starts both) or run `npm run dev:api` in a separate terminal.
2. **Database:** Ensure PostgreSQL is running and `apps/api/.env` has `DATABASE_URL`. Run `npm run db:migrate` and `npm run db:seed` if needed.
3. **Port in use:** Next.js will try the next port. Check the terminal for the actual URL.
4. **Documents won't open:** Ensure `NEXT_PUBLIC_API_URL=http://localhost:3001` in `apps/web/.env.local` and restart the dev server.

## If you see 404 on localhost:3000

Stale or conflicting dev processes can cause this. Run:

```bash
bash scripts/restore-dev.sh
npm run dev:all
```

Then open http://localhost:3000 (web) and http://localhost:3001 (API).

## Deployment & Upgrade Safety

Before production deployment:

- **Backup**: `npm run db:backup` (backs up database and uploads)
- **Migrations**: `npm run db:migrate:deploy` (production-safe; never use `migrate reset`)
- **Seed**: Blocked in production by default. See `docs/UPGRADE_RUNBOOK.md`.

Full guidance: `docs/UPGRADE_RUNBOOK.md`, `docs/DEPLOY_CHECKLIST.md`, `docs/UPGRADE_RULES.md`.
