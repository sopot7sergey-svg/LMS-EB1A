# Production Seed: Welcome Access Codes

This document describes how to seed the 205 welcome access codes into the production database.

## 1. Deployment Platform

Production uses **Railway**:
- API: `aipasapi-production.up.railway.app`
- Web: `aipasweb-production.up.railway.app`

## 2. Exact Command to Run Seed

From the project root:

```bash
cd apps/api && ALLOW_SEED_IN_PRODUCTION=1 NODE_ENV=production npm run db:seed
```

Or from the monorepo root:

```bash
ALLOW_SEED_IN_PRODUCTION=1 NODE_ENV=production npm run db:seed
```

(Ensure `DATABASE_URL` points to production. Railway injects it when running in the project context.)

## 3. Where to Run It

### Option A: Railway CLI (recommended)

If you use Railway CLI and have the API service linked:

```bash
cd /path/to/LMS-EB1A
railway link   # if not already linked to production project
railway run --service api "cd apps/api && ALLOW_SEED_IN_PRODUCTION=1 NODE_ENV=production npm run db:seed"
```

Or from the API directory:

```bash
cd apps/api
railway run "ALLOW_SEED_IN_PRODUCTION=1 NODE_ENV=production npm run db:seed"
```

### Option B: Railway Dashboard → API Service → Shell

1. Open Railway dashboard
2. Select the API service (aipasapi-production)
3. Open the Shell / Console tab
4. Run:
   ```bash
   ALLOW_SEED_IN_PRODUCTION=1 NODE_ENV=production npm run db:seed
   ```

### Option C: One-off job / deploy hook

Railway does not have built-in post-deploy hooks. To run the seed automatically after deploy, use GitHub Actions with `railway run` (see Railway docs: GitHub Actions Post-Deploy).

## 4. Idempotency and Safety

**Yes, the seed is idempotent and safe for existing production data.**

The AccessCode upsert uses:

```ts
await prisma.accessCode.upsert({
  where: { code },
  create: { code, status: 'active', grantCourseAccess: true, grantStartAccess: true, startDurationDays: 30 },
  update: {},
});
```

- **`update: {}`** — When a row exists, Prisma updates **no columns**. Existing `status`, `usedByUserId`, `usedAt` are **never touched**.
- **Used codes remain used** — If a code was redeemed (`status: 'used'`, `usedByUserId` set, `usedAt` set), the upsert finds it and applies the empty update → no change.
- **Missing codes are inserted** — If a code does not exist, it is created with `status: 'active'`.
- **Existing active codes** — Remain as-is (empty update).

## 5. No Duplicates

Upsert uses `where: { code }` (unique). Each code is either created or left unchanged. No duplicate rows.

## 6. Exact File and Code Path

**File:** `apps/api/prisma/seed.ts`  
**Lines:** 631–643

```ts
for (const { code } of welcomeCodes) {
  await prisma.accessCode.upsert({
    where: { code },
    create: {
      code,
      status: 'active',
      grantCourseAccess: true,
      grantStartAccess: true,
      startDurationDays: 30,
    },
    update: {},
  });
}
```

## 7. Used Codes Are Never Reset

- `usedByUserId` is **not** in the `update` object → never cleared.
- `usedAt` is **not** in the `update` object → never cleared.
- `status` is **not** in the `update` object → `'used'` stays `'used'`.
- Production redemption history is **never overwritten**.

## 8. Site Recognition After Seed

**Yes.** The API reads from the `AccessCode` table on each registration. As soon as the seed inserts the codes, the next registration with a valid code will succeed. No API restart needed.

## 9. API Restart / Redeploy

**No.** The seed only writes to the database. The API does not cache access codes. After the seed completes, codes are immediately available.

## 10. Copy-Paste Command Sequence for Production

```bash
# 1. Ensure you're in the project and linked to production (Railway)
cd /Users/sergeysopot/LMS-EB1A

# 2. Run the seed (Railway CLI - uses production DATABASE_URL)
railway run --service api "cd apps/api && ALLOW_SEED_IN_PRODUCTION=1 NODE_ENV=production npm run db:seed"

# Or if running from a shell that already has production DATABASE_URL:
cd apps/api
ALLOW_SEED_IN_PRODUCTION=1 NODE_ENV=production npm run db:seed
```

## Production Guard

The seed refuses to run when `NODE_ENV=production` unless `ALLOW_SEED_IN_PRODUCTION=1` is set. See `apps/api/prisma/seed.ts` lines 431–444.
