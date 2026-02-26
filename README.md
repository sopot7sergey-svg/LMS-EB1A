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

## If login shows "Failed to fetch"

1. **API not running:** Use `npm run dev:all` (starts both) or run `npm run dev:api` in a separate terminal.
2. **Database:** Ensure PostgreSQL is running and `apps/api/.env` has `DATABASE_URL`. Run `npm run db:migrate` and `npm run db:seed` if needed.
3. **Port in use:** Next.js will try the next port. Check the terminal for the actual URL.
