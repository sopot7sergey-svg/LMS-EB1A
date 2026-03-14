# Navigation Stability Fix Report

**Date:** 2026-03-14  
**Status:** Fixed

---

## 1. Root Cause of 500 Errors

**The 500 errors were NOT from the API.** They came from **Next.js static chunks** returning 500.

**Exact error:**
```
Cannot find module './522.js'
Require stack:
- .../apps/web/.next/server/webpack-runtime.js
- .../apps/web/.next/server/app/admin/users/page.js
```

**Cause:** Corrupted/inconsistent Next.js dev build. The webpack build referenced a chunk file (`522.js`) that did not exist. This typically happens when:
- The dev server runs for a long time and the build cache becomes inconsistent
- `.next` is partially cleared while the server is running
- Hot reload leaves orphaned chunk references

**Failing URLs (all returned 500):**
- `/_next/static/css/app/layout.css`
- `/_next/static/chunks/main-app.js`
- `/_next/static/chunks/webpack.js`
- `/_next/static/chunks/app-pages-internals.js`
- `/_next/static/chunks/app/login/page.js`
- `/_next/static/chunks/app/dashboard/page.js`
- ... and other chunk files

**Impact:** JavaScript never loaded, so the app stayed on the server-rendered "Loading..." state. No API calls were made because the client-side code never executed.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `apps/web/app/login/page.tsx` | Added 3s fallback timeout for `ready` state so login never stays on "Loading..." forever |
| `package.json` | Added `dev:clean` script: `rm -rf apps/web/.next apps/web/node_modules/.cache && npm run dev:all` |
| `verify-navigation-stability.mjs` | Added `failedUrls` capture for debugging |
| `debug-500.mjs` | New script to capture URLs returning 500 |

**No backend changes.** The API was never the problem.

---

## 3. Backend Routes / Services

**None were failing.** All API routes (`/api/auth/login`, `/api/auth/me`, `/api/progress/overall`, etc.) return 200 when called directly. The issue was entirely on the frontend: Next.js chunks returning 500 prevented the client from loading.

---

## 4. How the Loading Deadlock Was Fixed

1. **Root fix:** Clean rebuild. Running `rm -rf apps/web/.next apps/web/node_modules/.cache` and restarting the dev server removed the corrupted chunk references. Chunks then load successfully.

2. **Login page fallback:** Added a 3s timeout that forces `setReady(true)` if the initial `useEffect` is delayed. Ensures the login form or redirect is shown even in edge cases.

3. **Existing safeguards (unchanged):**
   - DashboardLayout: 2.5s loading fallback
   - API timeout: 12s
   - Error boundaries on key segments

---

## 5. Verification Results – Routes

| Route | Status | Body Len |
|-------|--------|----------|
| `/` (home) | OK | 1685 |
| `/login` | OK | 134 |
| `/register` | OK | 303 |
| `/dashboard` | OK | 677 |
| `/case` | OK | 236 |
| `/case/[id]` | SKIP | No case link in list |
| `/account` | OK | 370 |
| `/account/billing` | OK | 317 |
| `/account/plans` | OK | 803 |
| `/modules` | OK | 1400 |
| `/admin/dashboard` | OK | 246 |
| `/admin/users` | OK | 458 |
| `/admin/users/[id]` | OK | 448 |

**12 of 13 routes OK.** `case/[id]` skipped because no case link was found on the case list (test data dependent).

---

## 6. Verification Results – Transitions

| Transition | Result |
|------------|--------|
| login → dashboard | OK |
| dashboard → case | OK |
| case → account | OK |
| account → account/billing | OK |
| account/billing → account/plans | OK |
| account/plans → dashboard | OK |
| admin/users → admin/users/[id] | OK |

**All transitions OK.**

---

## 7. Screenshots

Screenshots saved to `screenshots/nav-verification/`:

- `home.png` – Landing page
- `login.png` – Login form
- `register.png` – Registration
- `dashboard.png` – Dashboard with content
- `case.png` – Case list
- `account.png` – Account settings
- `account-billing.png` – Billing
- `account-plans.png` – Plans
- `modules.png` – Modules
- `admin-dashboard.png` – Admin dashboard
- `admin-users.png` – Admin users list
- `admin-users-id.png` – Admin user detail

---

## 8. Recovery Steps (If 500s Return)

If you see 500 errors on static chunks again:

```bash
# Stop the dev server (Ctrl+C), then:
npm run dev:clean
```

Or manually:

```bash
rm -rf apps/web/.next apps/web/node_modules/.cache
npm run dev:all
```

---

## 9. Summary

- **Root cause:** Corrupted Next.js dev build (missing chunk `522.js`), not API or auth.
- **Fix:** Clean rebuild (`dev:clean` or manual `.next` + cache clear).
- **Result:** All main routes and transitions load and work correctly.
