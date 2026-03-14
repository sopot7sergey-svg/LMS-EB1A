# LMS EB-1A

AI-assisted course to build a submission-ready EB-1A I-140 petition package.

## Quick Start

### Easiest: run both web + API in one terminal

```bash
npm run dev:all
```

Starts the API (tries 3001, then fallbacks; writes port to `.dev-api-port`) and web app (port 3000 or next available). No manual port killing needed—API auto-selects a free port. Open the URL shown in the terminal.

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

**`apps/web/.env.local`** – Optional. Leave `NEXT_PUBLIC_API_URL` unset to use the Next.js proxy (recommended). Or set `NEXT_PUBLIC_API_URL=http://localhost:3001` for direct API access.

## If login shows "Cannot reach server" or "Failed to fetch"

1. **Start both API and web:** From project root run `npm run dev:all` (starts both in one terminal).
2. **Database:** Ensure PostgreSQL is running (`docker-compose up -d postgres`). Run `npm run db:migrate` and `npm run db:seed` if needed.
3. **Port in use:** Next.js will try the next port. Check the terminal for the actual URL.

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
