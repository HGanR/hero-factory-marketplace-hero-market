# Staging QA: Site Builder → Widget → CRM → Client Hub

Repeatable end-to-end QA for the **completed** consultant flow: Revenue OS client, Site Builder site, variants, saved version, AI agent + widget binding, deploy/export, widget traffic, CRM rows, and Client Hub surfaces.

**Scope:** This document targets a **real** staging (or pre-prod) deployment with MySQL/TiDB and full env. It complements (does not replace) unit tests under `src/lib/site-builder/` and `tests/playwright/`.

---

## Required environment variables

| Variable | Where | Why |
|----------|--------|-----|
| `DATABASE_URL` | App host + local QA machine (for SQL) | DB verification queries; app runtime. |
| `NEXT_PUBLIC_SITE_URL` | Staging Vercel/env | **Widget loader** and agency-widget **embed snippets**; export should emit real `/widget/loader.js` URLs. |
| `JWT_SECRET` | Staging | Auth cookies must verify. |
| `DATABASE_URL` (read-only QA user optional) | QA engineer laptop | Safer SQL verification. |

**Widget / Site Builder**

| Variable | Why |
|----------|-----|
| `NEXT_PUBLIC_SITE_URL` **or** schema `metadata.widgetIntegration.loaderOrigin` | Without one, exports show a **placeholder HTML comment** instead of `<script src="…/widget/loader.js">` — see `src/lib/site-builder/site-builder-widget-embed.ts`. |
| Widget binding **`allowedDomains`** (optional in DB) | If set, `GET/POST /api/widget/[key]/config|message` enforce **Origin** / **Referer**; staging curl/browser must send an allowed origin. |

**Revenue OS gate**

| Variable / data | Why |
|-----------------|-----|
| `marketplace_users.revenueOsAccess` (or admin bypass) | APIs under `/api/revenue-os/clients/...` call `enforceRevenueOsApiAccess`; denied users get **403** + `REVENUE_OS_ACCESS_DENIED`. |

---

## Required test account

- **Marketplace user** with:
  - Valid login (cookie `auth-token` JWT with `userId`).
  - **`revenueOsAccess`** enabled (unless testing admin-only paths).
- **Not** required to be admin for normal Site Builder + Client Hub flows documented here.

**Capture session cookie (browser):** DevTools → Application → Cookies → copy `auth-token` (and `admin-token` only if your flow uses it).

---

## Required test client

- Row in **`client_accounts`** with `ownerUserId` = test user’s numeric id.
- UUID **`clientId`** used in URLs: `/ai-revenue-os/clients/{clientId}/…` and `POST /api/site-builder/sites` body `{ "clientId": "<uuid>" }`.

**Verify ownership (SQL):**

```sql
SELECT id, ownerUserId, name, status
FROM client_accounts
WHERE id = '<CLIENT_ID>' AND ownerUserId = <TEST_USER_ID>;
```

---

## Required test site & agent

- **`web3_sites`**: `userId` = test user; optional `clientId` = same Client Hub client for attribution.
- **`ai_agents`**: `userId` = test user, `status` = `active`.
- **`ai_agent_site_bindings`**: links `agentId`, `siteId`, `widgetKey`, `isActive` = true; **`clientId`** should match Client Hub client if CRM contacts must appear **in that client’s inbox**.

---

## Test flow (10 steps) — UI, API, DB, pass criteria

| Step | UI behavior (log) | API (log status + JSON keys) | DB (log) | Pass |
|------|-------------------|--------------------------------|------------|------|
| **1** | Client Hub / Revenue OS → create or open client | `GET /api/revenue-os/clients`, `POST /api/revenue-os/clients` (if creating) | `client_accounts` row | 200 + row owned by user |
| **2** | `/site-builder` → create site (link client if “client build”) | `POST /api/site-builder/sites` with `name`, optional `clientId` | `web3_sites` insert | 201 + `site.id` |
| **3** | AI panel → full generate / variants | `POST /api/site-builder/ai/pipeline` (`step: "full"`, `variantCount`, …) | (often in-memory until save) | 200 + schemas / planner |
| **4** | Save version | `POST /api/site-builder/sites/{siteId}/versions` | `web3_site_versions` | 201 + version id; site `currentVersionId` updated when UI sets it |
| **5** | Attach agent / agency widget wizard | `POST /api/site-builder/sites/{siteId}/agency-widget` body: `agentId`, optional `clientId`, `applyToSchema`, `loaderOrigin` | `ai_agent_site_bindings`; optional `web3_sites.clientId` | 200 + `widgetKey` in response |
| **6** | Confirm **widgetKey** in UI + `GET` agency-widget | `GET /api/site-builder/sites/{siteId}/agency-widget` | binding row | Listed `widgetKey` matches UI |
| **7** | Export / deploy | `POST …/deploy`, export/deliverables as your product exposes | `web3_site_versions` deploy fields / IPFS per impl | Deploy succeeds; export HTML contains loader **if** `NEXT_PUBLIC_SITE_URL` or loader origin set |
| **8** | Widget test page or staging page with loader | `POST /api/widget/{widgetKey}/message` with JSON body (see below) | `widget_conversations`, `widget_messages` | **200** + `reply` + `conversationId` |
| **9** | — | Same POST | `crm_contacts`, `crm_conversations`, `crm_messages` | Rows exist **only if** `sessionId` in body **and** binding has `siteId`; CRM errors are **swallowed** (see diagnosis table) |
| **10** | Client Hub inbox / activity / analytics | `GET /api/revenue-os/clients/{clientId}/inbox`, `/activity`, `/analytics` | inbox driven by `crm_*` for `clientId` | Inbox shows webchat thread when **`crm_contacts.client_id`** = client |

**Widget POST body (minimum for CRM):**

```json
{
  "message": "Staging QA hello",
  "sessionId": "qa-staging-session-001",
  "page": { "url": "https://allowed.example/page", "title": "QA" }
}
```

Send header **`Origin: https://allowed.example`** (or your allowlisted origin). If binding has **no** `allowedDomains`, origin checks may be relaxed — confirm in `src/lib/widget/allowed-domains.ts` behavior.

---

## Browser steps (manual checklist)

1. Log in as test user → confirm `/ai-revenue-os` loads (no access denied).
2. Open or create **Client** → copy `clientId` from URL.
3. Open **`/site-builder`** → **Create site** with name + optional slug; if “for client”, set `clientId`.
4. Run **AI generate** (planner + full pipeline) → pick **variant** in UI.
5. **Save version** (sticky bar / versions UI) → note `versionId` from Network tab if needed.
6. **Attach agent** → pick agent → bind widget → optional “apply to schema” + loader origin.
7. Copy **embed snippet** from agency-widget response or UI → place on **HTTPS** test page on allowlisted domain.
8. Open widget → send message → open **Client Hub → Inbox** for the same client.
9. **Activity** / **Analytics** pages for client → confirm new signals where applicable.
10. **Deploy** + **export** → grep export HTML for `widget/loader.js` and `data-widget-key`.

---

## API reference (curl)

Use **`scripts/qa/site-builder-client-flow.curl.sh`** after filling placeholders, or see **Smoke script** below.

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/revenue-os/clients/{clientId}/summary` | Cookie |
| `GET` | `/api/site-builder/sites/{siteId}` | Cookie |
| `GET` | `/api/site-builder/sites/{siteId}/versions` | Cookie |
| `POST` | `/api/site-builder/sites/{siteId}/versions` | Cookie (save) |
| `GET` | `/api/site-builder/sites/{siteId}/agency-widget` | Cookie |
| `POST` | `/api/site-builder/sites/{siteId}/agency-widget` | Cookie (attach) |
| `GET` | `/api/widget/{widgetKey}/config` | Public; **Origin** matters if domains set |
| `POST` | `/api/widget/{widgetKey}/message` | Public; **Origin** + rate limit |
| `GET` | `/api/revenue-os/clients/{clientId}/inbox` | Cookie |
| `GET` | `/api/revenue-os/clients/{clientId}/activity` | Cookie |
| `GET` | `/api/revenue-os/clients/{clientId}/analytics` | Cookie |

**Natural-language edits:** `POST /api/site-builder/assistant/execute-intent` requires a **saved version** first — see diagnosis table.

---

## SQL verification queries

Replace `<SITE_ID>`, `<VERSION_ID>`, `<WIDGET_KEY>`, `<CLIENT_ID>`, `<TEST_USER_ID>`, `<SESSION_ID>`.

### `web3_sites`

```sql
SELECT id, userId, clientId, name, status, currentVersionId, updatedAt
FROM web3_sites
WHERE id = '<SITE_ID>' AND userId = <TEST_USER_ID>;
```

### `web3_site_versions`

```sql
SELECT id, siteId, version, status, LENGTH(schemaJson) AS schema_bytes, updatedAt
FROM web3_site_versions
WHERE siteId = '<SITE_ID>'
ORDER BY version DESC
LIMIT 5;
```

### `ai_agent_site_bindings`

```sql
SELECT id, siteId, agentId, widgetKey, isActive, clientId, allowedDomains, updatedAt
FROM ai_agent_site_bindings
WHERE siteId = '<SITE_ID>' OR widgetKey = '<WIDGET_KEY>';
```

### `widget_conversations` / `widget_messages`

```sql
SELECT id, public_conversation_id, site_id, session_id, last_message_at
FROM widget_conversations
WHERE site_id = '<SITE_ID>'
ORDER BY last_message_at DESC
LIMIT 5;

SELECT wm.id, wm.role, LEFT(wm.content_text, 80) AS preview, wm.created_at
FROM widget_messages wm
JOIN widget_conversations wc ON wc.id = wm.conversation_id
WHERE wc.site_id = '<SITE_ID>'
ORDER BY wm.created_at DESC
LIMIT 10;
```

### `crm_contacts` / `crm_conversations` / `crm_messages`

Synthetic email pattern: `webchat+<sessionId>@<host>.widget` (see `src/lib/widget/crm-logger.ts`).

```sql
SELECT id, email, clientId, leadSource, tags, updatedAt
FROM crm_contacts
WHERE userId = <TEST_USER_ID>
  AND (email LIKE '%<SESSION_ID>%' OR tags LIKE '%<SITE_ID>%')
ORDER BY updatedAt DESC
LIMIT 5;

SELECT c.id, c.channel, c.lastMessagePreview, c.unreadCount, c.lastMessageAt
FROM crm_conversations c
JOIN crm_contacts ct ON ct.id = c.contactId
WHERE ct.userId = <TEST_USER_ID> AND ct.clientId = '<CLIENT_ID>'
ORDER BY c.lastMessageAt DESC
LIMIT 10;

SELECT m.id, m.role, LEFT(m.content, 80), m.createdAt
FROM crm_messages m
JOIN crm_conversations c ON c.id = m.conversationId
JOIN crm_contacts ct ON ct.id = c.contactId
WHERE ct.userId = <TEST_USER_ID> AND ct.clientId = '<CLIENT_ID>'
ORDER BY m.createdAt DESC
LIMIT 15;
```

### `client_hub_automation_events`

Used for automation / inbox actions (e.g. mark qualified), **not** for every widget message.

```sql
SELECT id, eventType, refId, createdAt, JSON_EXTRACT(metadata, '$.summary') AS summary_hint
FROM client_hub_automation_events
WHERE clientId = '<CLIENT_ID>'
ORDER BY createdAt DESC
LIMIT 20;
```

---

## Pre-flight environment checks

Run mentally or via smoke script **before** the 10-step flow:

| Check | How | If fail |
|-------|-----|---------|
| **Loader origin** | `NEXT_PUBLIC_SITE_URL` set on staging **or** explicit `loaderOrigin` in schema / agency-widget POST | Export shows placeholder; widget script won’t load from expected host. |
| **`DATABASE_URL`** | App healthy; SQL client can connect | No DB verification; app 500s on DB routes. |
| **Widget allowlist** | Binding `allowedDomains` JSON vs your test **Origin** | **403** on config/message. |
| **Client belongs to user** | SQL on `client_accounts` | 404 / empty Hub. |
| **Site belongs to user** | SQL on `web3_sites` | 404 on site APIs. |
| **Agent belongs to user** | SQL on `ai_agents` | Agency-widget attach fails. |
| **Binding `clientId`** | SQL on `ai_agent_site_bindings.clientId` matches Hub client | CRM contact may exist with **`clientId` NULL** → **inbox empty** for that client. |
| **Revenue OS access** | User flag / admin | **403** `REVENUE_OS_ACCESS_DENIED` on Client Hub APIs. |
| **Deploy vs version** | After save, `web3_sites.currentVersionId` matches intended version | Deploy may target wrong snapshot — see diagnosis table. |

---

## Failure diagnosis table

| Symptom | Likely cause | Inspect | Fix |
|---------|--------------|---------|-----|
| Widget **config 500** | DB/join error, missing tables, or bad binding row | `src/app/api/widget/[widgetKey]/config/route.ts`, server logs, `ai_agents` + `ai_agent_site_bindings` | Run `ensureAgentTables`; fix inactive agent or broken FK. |
| Widget message **200** but **no CRM** row | CRM block requires `chatSessionId` + `siteId`; CRM try/catch swallows errors | `src/app/api/widget/[widgetKey]/message/route.ts` (~381–399), `src/lib/widget/crm-logger.ts` | Send **`sessionId`** in JSON; ensure binding has **site**; check server logs for `[widget] CRM log failed`. |
| Client Hub **inbox empty** | `crm_contacts.clientId` NULL or wrong client vs Hub filter | `listInboxForClient` in `src/lib/revenue-os/client-hub-queries.ts` | Set **`clientId`** on binding (agency-widget POST) and/or site; re-send widget message. |
| Export **missing widget script** | No `NEXT_PUBLIC_SITE_URL` / no `loaderOrigin` | `site-builder-widget-embed.ts`, agency-widget `loaderHint` | Set env or pass `loaderOrigin` when merging schema. |
| **execute-intent** “save version first” | No `web3_site_versions` row for site | `src/app/api/site-builder/assistant/execute-intent/route.ts` | Save version in UI, then retry NL edit. |
| **`clientId` null** on CRM contact | Binding / site not linked to client when logging | `logWebChatMessage` `crmClientId` from `row.bindingClientId` | POST agency-widget with `clientId`; upsert binding sets `ai_agent_site_bindings.clientId`. |
| **Deploy reads old version** | `currentVersionId` not updated after save | `web3_sites.currentVersionId`, deploy route input | PATCH site or save flow to set current version before deploy. |
| **403** on Revenue OS APIs | `revenueOsAccess` false | `src/lib/revenue-os-api-access.ts` | Enable access for user or use admin account per policy. |

---

## Automated smoke test

**Script:** `scripts/qa/site-builder-client-flow-smoke.ts`  
**Run (from `hero-market/`):**

```bash
export QA_BASE_URL="https://your-staging.example"
export QA_AUTH_TOKEN="<jwt-cookie-value-only>"   # or use QA_COOKIE_HEADER below
export QA_CLIENT_ID="<uuid>"
export QA_SITE_ID="<uuid>"
export QA_WIDGET_KEY="<string>"
# Optional: send a real widget message (writes DB)
export QA_WIDGET_MESSAGE=1
export QA_WIDGET_ORIGIN="https://your-allowlisted-origin.example"
# Optional: same session id for POST + SQL (or omit and script generates one when QA_WIDGET_MESSAGE=1)
export QA_WIDGET_SESSION_ID="qa-staging-session-001"
npm run qa:site-builder-client-flow
```

**Optional SQL verification (read-only `SELECT`s):**

When **`QA_DATABASE_URL`** or **`DATABASE_URL`** is set, the smoke script runs nine checks after HTTP:

| # | Check |
|---|--------|
| 1 | `web3_sites.clientId` = `QA_CLIENT_ID` for `QA_SITE_ID` |
| 2 | Active `ai_agent_site_bindings` row for site + `QA_WIDGET_KEY` |
| 3 | Binding `clientId` = `QA_CLIENT_ID` |
| 4 | `widget_conversations` for `session_id` + `widget_key_snapshot` |
| 5 | `widget_messages` joined to that conversation |
| 6 | `crm_contacts` with `clientId` + synthetic email `webchat+<session>@%.widget` |
| 7 | `crm_conversations` (`webchat`) for that contact |
| 8 | `crm_messages` for that conversation |
| 9 | **API:** inbox JSON contains a **webchat** row whose contact email includes `webchat+<session>@` |

- If **no** DB URL is set → SQL block is **skipped** (exit not failed for that reason).
- Set **`QA_SQL_VERIFY=0`** to skip SQL even when `DATABASE_URL` is present.
- Checks **4–8** require a **session id**: use `QA_WIDGET_SESSION_ID`, or run with **`QA_WIDGET_MESSAGE=1`** (script assigns a session if unset).
- A **400 ms** delay runs after a widget POST before SQL to reduce read-your-writes lag on TiDB.

**Alternative cookie form:**

```bash
export QA_COOKIE_HEADER='auth-token=...; other=...'
```

**Destructive / writes:**

| Env | Behavior |
|-----|----------|
| `QA_WIDGET_MESSAGE=1` | `POST` widget message (creates widget + CRM traffic if conditions met). |
| `QA_CREATE=1` | Reserved for future automated creates (sites/clients). **Not** implemented by default — manual flow preferred. |

**Safety notes (SQL):**

- Only **`SELECT`** queries are executed; no DDL/DML from the smoke script.
- Prefer a **read-only** DB user and/or **`QA_DATABASE_URL`** pointing at a replica.
- **Never** commit real `DATABASE_URL` / JWTs to git; use CI secrets or a local `.env` ignored by version control.
- Column names match **camelCase** CRM / site-builder tables in this repo (`contactId`, `conversationId`, `clientId`, …); `widget_*` tables use **snake_case** (`session_id`, `conversation_id`, …).

---

## Known limitations

- **Smoke script** does not drive the browser, **AI pipeline**, or **IPFS deploy**; it validates **auth’d APIs + public widget endpoints**, optional widget POST, and optional **read-only SQL**.
- **CRM** verification via API alone is unreliable; the smoke script now can assert **SQL + inbox JSON** when a DB URL and session are provided.
- **Client Hub activity** may not list every CRM message unless the activity adapter includes those sources — cross-check SQL.
- **Rate limits** on widget may cause **429** during repeated smoke runs — increase delay or rotate keys/session.
- Local **Jest** `widget-routes.integration.spec.ts` may fail if mocks drift from route joins — staging behavior is authoritative.

---

## Files in this QA pack

| File | Purpose |
|------|---------|
| `scripts/qa/site-builder-client-flow.md` | This document |
| `scripts/qa/site-builder-client-flow.curl.sh` | Placeholder curl checks |
| `scripts/qa/site-builder-client-flow-smoke.ts` | Optional automated HTTP smoke |

---

## Revision

Update this doc when API paths, table names, or CRM logging conditions change.
