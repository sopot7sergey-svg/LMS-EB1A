# Ultra Request & Admin Approval Flow – Report

**Date:** 2026-03-14  
**Status:** Complete

---

## 1. Root Cause of the 404

**Cause:** The Next.js proxy was sending `/api/*` requests to the wrong port.

- `next.config.js` used `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'`.
- The API runs on a different port (e.g. 24604) when started via `dev:all`.
- When `NEXT_PUBLIC_API_URL` was unset (e.g. running `dev:web` alone), the proxy targeted port 3001.
- Nothing on 3001 handled `POST /api/account/request-ultra`, so the response was 404 "Cannot POST /api/account/request-ultra".

---

## 2. Files Changed

| File | Change |
|------|--------|
| `apps/web/next.config.js` | Added `getApiUrl()` that reads `.dev-api-port` when `NEXT_PUBLIC_API_URL` is unset, so the proxy targets the correct API port |
| `apps/web/app/account/plans/page.tsx` | Updated `handleRequestUltra` so duplicate "already pending" responses trigger a refresh without an alert |

---

## 3. Student Route/Action That Creates the Ultra Request

- **Route:** `POST /api/account/request-ultra`
- **Handler:** `apps/api/src/routes/account.ts` – `router.post('/request-ultra', authenticate, ...)`
- **Client:** `api.account.requestUltra(token)` in `apps/web/lib/api.ts`
- **UI:** "Request Ultra" button on `/account/plans` in the Ultra card

---

## 4. How Pending Requests Are Stored

- **Model:** `UltraEligibilityRequest` (Prisma)
- **Fields:** `id`, `userId`, `status` (pending | approved | rejected), `requestedAt`, `approvedAt`, `approvedById`
- **Creation:** `prisma.ultraEligibilityRequest.create({ data: { userId, status: 'pending' } })`
- **Duplicate handling:** If a pending request exists for the user, the API returns 400 "You already have a pending Ultra request" and does not create another record.

---

## 5. How Admin Approval Works

- **Route:** `PATCH /api/admin/ultra-requests/:id/approve`
- **Handler:** `apps/api/src/routes/admin.ts`
- **Flow:**
  1. Load request by `id`.
  2. Ensure status is `pending`.
  3. Update request: `status: 'approved'`, `approvedAt`, `approvedById`.
  4. Call `setUltraPlan(request.userId, 'monthly')` to grant Ultra.
  5. Return success.

---

## 6. How Admin Rejection Works

- **Route:** `PATCH /api/admin/ultra-requests/:id/reject`
- **Handler:** `apps/api/src/routes/admin.ts`
- **Flow:**
  1. Load request by `id`.
  2. Ensure status is `pending`.
  3. Update request: `status: 'rejected'`, `approvedAt`, `approvedById`.
  4. No plan changes; user does not receive Ultra.

---

## 7. Approval Activates Ultra for That User

- `setUltraPlan(userId, 'monthly')` in `apps/api/src/services/access.ts`:
  - Creates/updates `AppAccess` with `plan: 'ultra'`, `status: 'active'`, `uploadEnabled: true`, `maxCases: 5`.
  - Updates `User` with `uploadEnabled: true`.
- The user’s access is updated in the database and reflected in `getAccess()`.

---

## 8. Ultra Approval Enables Upload/Add Documents

- `setUltraPlan` sets `uploadEnabled: true` on both `AppAccess` and `User`.
- `getAccess()` returns `uploadEnabled` from `User`.
- `canUpload(access)` requires `uploadEnabled && appAccessActive && !suspended`.
- After approval, the student can use Add/upload documents in the UI.

---

## 9. Verification Results

**Automated run:** `node verify-ultra-flow.mjs`

| Step | Result |
|------|--------|
| Student login | OK |
| Request Ultra | OK |
| Admin sees requests | OK |
| Admin approve | OK |
| Student has Ultra | OK |

**Plans after approval:**
```json
{
  "currentPlan": "ultra",
  "planStatus": "active",
  "ultraEligibilityRequest": { "status": "approved", "requestedAt": "..." }
}
```

**Screenshots:** `screenshots/ultra-flow/`
- `01-plans-before-request.png`
- `03-admin-ultra-requests.png`
- `04-after-approve.png`
- `05-student-after-approval.png`

---

## Summary

- **404 fix:** Proxy now uses `.dev-api-port` when `NEXT_PUBLIC_API_URL` is unset.
- **Request flow:** Student uses "Request Ultra" on `/account/plans`; requests are stored in `UltraEligibilityRequest`.
- **Admin flow:** Admin sees requests on `/admin/ultra-requests` and can Approve or Reject.
- **Approval:** Activates Ultra and enables upload/add documents for that user.
