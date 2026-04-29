# Platform API Gateway v1

Unified, versioned, policy-controlled API layer in front of the canonical object model and event system.

---

## Overview

| Aspect | Implementation |
|--------|----------------|
| **Base URL** | `/api/v1` |
| **Auth** | Bearer token (API key) or session cookie |
| **Scopes** | `read:trusts`, `write:trusts`, `read:assets`, etc. |
| **Resource format** | `{ id, type, metadata, relationships, createdAt, updatedAt }` |

---

## Authentication

### API Key (Bearer)

```
Authorization: Bearer hf_live_xxxxxxxxxxxx
```

- Create keys at `/developers` with scoped permissions
- Keys are hashed; raw key shown once on creation
- `lastUsedAt` updated on each request

### Session (Cookie)

- Logged-in users get full scope access via cookie
- Same endpoints, no Bearer header required

---

## Scopes

| Scope | Resources |
|-------|-----------|
| `read:trusts` | GET /trusts, /trusts/:id |
| `write:trusts` | (future) |
| `read:assets` | GET /assets, /assets/:id, /trusts/:id/assets |
| `write:assets` | (future) |
| `read:instruments` | GET /instruments, /instruments/:id, /trusts/:id/instruments |
| `write:instruments` | (future) |
| `read:events` | GET /events, /events/:id |
| `read:workflows` | GET /workflows, /workflows/:id |
| `write:workflows` | (future) |
| `read:accounting` | (future) |
| `write:accounting` | (future) |

**Legacy:** `trust_records` → read:trusts, read:assets, read:instruments. `accounting` → read:accounting.

---

## Endpoints

### Trusts

- `GET /api/v1/trusts` — List trusts
- `GET /api/v1/trusts/:id` — Get trust
- `GET /api/v1/trusts/:id/assets` — List trust assets
- `GET /api/v1/trusts/:id/instruments` — List trust instruments

### Assets

- `GET /api/v1/assets` — List assets (optional `?trustId=`)
- `GET /api/v1/assets/:id` — Get asset

### Instruments

- `GET /api/v1/instruments` — List instruments (optional `?trustId=`)
- `GET /api/v1/instruments/:id` — Get instrument

### Events

- `GET /api/v1/events` — List platform events (`?limit=50`, `?trustId=`)
- `GET /api/v1/events/:id` — Get event

### Workflows

- `GET /api/v1/workflows` — List workflows
- `GET /api/v1/workflows/:id` — Get workflow

---

## Response Format

```json
{
  "data": { ... },
  "meta": { "count": 10 }
}
```

Single resource: `{ "data": { ... } }`

---

## Error Format

```json
{
  "error": "Insufficient permissions",
  "code": "forbidden"
}
```

| Code | Status |
|------|--------|
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `not_found` | 404 |
| `bad_request` | 400 |

---

## File Structure

```
src/lib/platform-api/
  auth.ts       — API key + session resolution
  scopes.ts     — Scope definitions, resolution
  errors.ts     — Standard error responses
  serializers.ts — Resource normalization
  audit.ts      — API key lastUsedAt

src/app/api/v1/
  route.ts           — GET /api/v1 (info)
  trusts/
  assets/
  instruments/
  events/
  workflows/
```

---

## Next Steps

1. **Rate limiting** — Per-key quotas
2. **Audit table** — Log all API calls
3. **OpenAPI spec** — Publish at /api/v1/openapi.json
4. **Write operations** — POST/PATCH/DELETE for trusts, assets, instruments
5. **Accounting endpoints** — /api/v1/accounting/entries
