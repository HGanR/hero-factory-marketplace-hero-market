# Revenue OS access control — inventory

This document describes the **current** Revenue OS (ROS) access surface: server layout/page gates, API families, public exceptions, and the stable denial response. It is meant for engineers changing auth, admin toggles, or route structure.

**Core modules**

- `src/lib/revenue-os-session.ts` — `evaluateRevenueOsSession(getCookie)` → `allow` | `deny` | `no_session`
- `src/lib/revenue-os-api-access.ts` — `enforceRevenueOsApiAccess(request?)` for App Router API handlers
- `src/lib/revenue-os-access-server.ts` — `assertMarketplaceRevenueOsAccess(returnPath)` for server layouts (redirects)

**Session rules (summary)**

- **Admin bypass:** `admin-token` or `auth-token` JWT with `isAdmin: true` → `allow` (no `revenueOsAccess` DB check).
- **Marketplace user:** valid `auth-token` with `userId` → DB `marketplace_users.revenueOsAccess`; `false` or missing row → `deny`.
- **No / invalid session:** `no_session` for evaluation; API gate returns `null` so handlers can still return 401 or signed-out payloads.

---

## Protected page / layout routes

These layouts call `assertMarketplaceRevenueOsAccess` before rendering children:

| Route segment | Layout file |
|---------------|-------------|
| `/ai-revenue-os` | `src/app/ai-revenue-os/layout.tsx` |
| `/revenue-os/dashboard` | `src/app/revenue-os/dashboard/layout.tsx` |
| `/revenue-os/social-lead-intelligence` | `src/app/revenue-os/social-lead-intelligence/layout.tsx` |

Unauthenticated users are redirected to `/?returnTo=…`. Denied users are redirected to `/ros-access-denied`.

---

## Protected API route families

Handlers in these trees call `enforceRevenueOsApiAccess` at the start of each exported HTTP method (see `scripts/apply-revenue-os-api-guard.mjs` for the canonical list used when adding new routes):

| Family | Path prefix (App Router) |
|--------|---------------------------|
| Revenue OS product APIs | `/api/revenue-os/...` |
| Campaigns (governance, posts, reviewers, queue) | `/api/campaigns/...` |
| Bentley social / SLI product APIs | `/api/bentley-social-leads/...` |
| Social accounts + OAuth | `/api/social/...` |
| Trends (ROS-related) | `/api/trends/generate` |
| Current client context for dashboard | `/api/clients/me` |

---

## Intentionally public / non-gated

- **`/revenue-os`** — Marketing landing (`src/app/revenue-os/page.tsx`). No `assertMarketplaceRevenueOsAccess` in this segment (nested gated routes use their own layouts under `dashboard/` and `social-lead-intelligence/`).
- **`/ros-access-denied`** — Explains denial; must stay reachable without passing ROS gate.
- **APIs outside the families above** — e.g. other `/api/clients/*` (except `me`), marketplace login/register, health, admin APIs, etc., unless individually gated elsewhere.

---

## Stable 403 response (blocked marketplace session)

When `evaluateRevenueOsSession` is `deny`, `enforceRevenueOsApiAccess` returns **HTTP 403** with JSON:

```json
{
  "error": "REVENUE_OS_ACCESS_DENIED",
  "message": "See admin for access to Revenue OS."
}
```

Constants: `REVENUE_OS_ACCESS_DENIED_ERROR`, `REVENUE_OS_ACCESS_DENIED_MESSAGE` in `src/lib/revenue-os-api-access.ts`.

---

## OAuth (`/api/social/**`) — intentional behavior

**Review (no semantic change):** Social routes are included in the same API gate as other ROS-adjacent product APIs.

- **`GET /api/social/oauth/[platform]/start`** — Gated. Starting OAuth to connect an account for the Campaign / Revenue OS flows requires a session that passes ROS access (or admin bypass).
- **`GET /api/social/oauth/[platform]/callback`** — Gated. Completing the OAuth round-trip also runs the gate so users who lost ROS access cannot finish token exchange via a stale browser tab without a valid allowed session (same-site cookies still apply).

**`GET/POST /api/social/accounts` and related** — Gated; listing or mutating connected accounts is treated as product surface.

**Exceptions:** None documented. If a future flow must allow OAuth without ROS (e.g. global settings), that would require an explicit product decision and a documented exception here.

---

## Admin audit

Toggling ROS access: `POST /api/admin/toggle-revenue-os-access` — logs `revenueOsAccess` before/after, actor id/username, and timestamp in `admin_logs.details` (see route implementation).

---

## Regression tests

- `src/lib/revenue-os-access-control.smoke.spec.ts` — single smoke suite: blocked → 403 `REVENUE_OS_ACCESS_DENIED`, allowed → gate passes, admin → bypass (no DB), `/revenue-os` marketing page has no `assertMarketplaceRevenueOsAccess`.
- `src/lib/revenue-os-session.spec.ts`, `src/lib/revenue-os-api-access.spec.ts`, and selected route `*.spec.ts` files — finer-grained cases.

When adding a new ROS-facing API under the families above, run `node scripts/apply-revenue-os-api-guard.mjs` (or add the guard manually) and extend this doc if the surface changes.
