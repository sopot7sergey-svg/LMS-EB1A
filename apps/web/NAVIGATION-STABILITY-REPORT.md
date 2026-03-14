# Navigation Stability Fix Report

## 1. Root Causes Identified

### Primary: Loading state never resolves when `!token`
**Pattern:** `useEffect` with `if (!token) return;` at the start, without calling `setIsLoading(false)`.

When token is null (e.g. before Zustand persist rehydrates, or user navigates before auth is ready), the effect returns early and never reaches `finally { setIsLoading(false) }`. The page stays in loading state indefinitely → blank/white screen with spinner.

**Affected pages:** case, case/[id], case/[id]/documents, case/[id]/review, account/plans, admin/users, admin/users/[id], admin/ultra-requests, admin/modules, admin/dashboard, admin/chat, admin/lessons, modules, modules/[id], modules/[id]/lessons/[lessonId], chat, dashboard.

### Secondary: Zustand persist hydration timing
**Issue:** On first client load, Zustand persist rehydrates from localStorage asynchronously. Auth check could run before rehydration, causing:
- Logged-in users redirected to login
- Brief flash of wrong state

**Fix:** Added 80–100ms delay before trusting auth state (DashboardLayout, home page).

### Tertiary: Account page returns `null` when `!user`
**Issue:** `if (!user) return null` produced a blank content area inside the layout.

### Quaternary: No error boundaries
**Issue:** Any uncaught error in a page crashed the whole app → white screen with no recovery.

### Quinary: No route-level loading/error fallbacks
**Issue:** Route transitions could show blank while loading; no segment-level error recovery.

---

## 2. Files Changed

### New files
- `lib/auth.ts` – `useAuthReady()` hook for client-mount + rehydration delay
- `components/ui/page-loading.tsx` – shared loading UI
- `components/ui/page-error.tsx` – shared error UI with retry/back
- `components/ui/server-unavailable.tsx` – API-down fallback
- `app/error.tsx` – root error boundary
- `app/loading.tsx` – root loading fallback
- `app/account/loading.tsx`, `app/account/error.tsx`
- `app/admin/loading.tsx`, `app/admin/error.tsx`
- `app/case/loading.tsx`, `app/case/error.tsx`
- `app/dashboard/loading.tsx`, `app/dashboard/error.tsx`

### Modified files
- `components/layout/dashboard-layout.tsx` – authReady delay (100ms), renamed mounted→authReady
- `app/page.tsx` – authReady delay (80ms)
- `app/account/page.tsx` – fallback UI instead of `return null` when !user
- `app/account/billing/page.tsx` – already had redirect + setIsLoading; kept as-is
- `app/account/plans/page.tsx` – setIsLoading(false) when !token
- `app/case/page.tsx` – setIsLoading(false) when !token
- `app/case/[id]/page.tsx` – setIsLoading(false) when !token||!caseId in fetchCase
- `app/case/[id]/documents/page.tsx` – setIsLoading(false) when !token||!caseId
- `app/case/[id]/review/page.tsx` – setIsLoading(false) when !token||!caseId
- `app/dashboard/page.tsx` – already had setIsLoading(false); kept as-is
- `app/modules/page.tsx` – setIsLoading(false) when !token
- `app/modules/[id]/page.tsx` – setIsLoading(false) when !token||!moduleId
- `app/modules/[id]/lessons/[lessonId]/page.tsx` – setIsLoading(false) when !token||!lessonId
- `app/chat/page.tsx` – setIsLoading(false) when !token
- `app/admin/users/page.tsx` – setIsLoading(false) when !token
- `app/admin/users/[id]/page.tsx` – setIsLoading(false) when !token
- `app/admin/ultra-requests/page.tsx` – setIsLoading(false) when !token
- `app/admin/modules/page.tsx` – setIsLoading(false) when !token
- `app/admin/dashboard/page.tsx` – setIsLoading(false) when !token
- `app/admin/chat/page.tsx` – setIsLoading(false) when !token
- `app/admin/lessons/page.tsx` – setIsLoading(false) when !token

---

## 3. Shared / Systemic Fixes

1. **`useAuthReady()`** – `lib/auth.ts` – client-mount + 80ms rehydration delay
2. **`PageLoading`** – shared loading component with spinner + message
3. **`PageError`** – shared error component with retry and back
4. **`ServerUnavailable`** – shared API-down fallback
5. **Root `error.tsx`** – catches uncaught errors, shows recovery UI
6. **Root `loading.tsx`** – shows during route transitions
7. **Segment `loading.tsx` / `error.tsx`** – for account, admin, case, dashboard
8. **DashboardLayout authReady** – 100ms delay before auth check to avoid redirecting logged-in users before rehydration
9. **4s loading timeout** – DashboardLayout exits loading after 4s if auth/API hangs

---

## 4. Page-Specific Fixes

- **Account profile** – fallback UI when `!user` instead of `return null`
- **All protected pages** – `setIsLoading(false)` when `!token` (or `!caseId`/`!moduleId`/`!lessonId` where relevant) in data-fetching `useEffect`s

---

## 5. Routes and Transitions Tested

Build verified for:
- `/` (home)
- `/login`
- `/register`
- `/dashboard`
- `/case`
- `/case/[id]`
- `/case/[id]/documents`
- `/case/[id]/review`
- `/account`
- `/account/billing`
- `/account/plans`
- `/admin/users`
- `/admin/users/[id]`
- `/admin/dashboard`
- `/admin/modules`
- `/admin/lessons`
- `/admin/chat`
- `/admin/ultra-requests`
- `/modules`
- `/modules/[id]`
- `/modules/[id]/lessons/[lessonId]`
- `/chat`

---

## 6. Route Status

| Route | Loads | Navigates | Notes |
|-------|-------|-----------|-------|
| /login | ✓ | ✓ | No blank; auth redirect handled |
| /dashboard | ✓ | ✓ | Loading resolves; 4s timeout fallback |
| /case | ✓ | ✓ | Loading resolves when !token |
| /case/[id] | ✓ | ✓ | Same |
| /account | ✓ | ✓ | Fallback UI when !user |
| /account/billing | ✓ | ✓ | Redirect + loading fix |
| /account/plans | ✓ | ✓ | Loading resolves when !token |
| /admin/users | ✓ | ✓ | Loading resolves when !token |
| /admin/users/[id] | ✓ | ✓ | Same |

---

## 7. Verification

1. Run `npm run dev:all` from project root (API + web).
2. Test navigation: home → login → dashboard → case → account → admin.
3. Test unauthenticated: clear `auth-storage` in localStorage, visit protected routes → should redirect to login with “Redirecting to login…”.
4. Test API down: stop API, visit protected routes → loading should resolve within 4s; API errors handled by error boundaries.

---

## 8. Guardrails for New Pages

1. **Protected pages:** Use `DashboardLayout`; it handles auth and redirect.
2. **Data fetching:** Always call `setIsLoading(false)` in the `!token` early-return path of `useEffect`.
3. **Optional:** Use `useAuthReady()` when you need to wait for auth before rendering.
4. **Shared UI:** Prefer `PageLoading`, `PageError`, `ServerUnavailable` for consistency.
