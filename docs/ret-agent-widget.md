# RET + AI widget (same agent, two surfaces)

The **Site Builder** marketing site and the in-app **`/ret`** page can use the **same** AI Agency agent. Behavior differs by **`context.pageType`** and optional **`retSnapshot`**.

## Flow

| Surface | `pageType` | How context is set |
|--------|------------|-------------------|
| Published site (Custom JS) | `site` (default) | `window.TROO_AGENT_CONFIG` before loading `/widget/loader.js` |
| RET intake (`/ret`) | `ret` | `RetAgentWidget` sets config + `retSnapshot` + `retClientSessionId` |
| Insurance broker demo | `insurance` | `InsuranceLeenaChat` sets `context` on each message POST |
| Transportation demo | `transport` | `TransportLeenaChat` sets `context` on each message POST |
| Tax professional demo | `tax` | `TaxLeenaChat` sets `context` on each message POST |
| Barbershop demo | `barbershop` | `BarbershopLeenaChat` sets `context` on each message POST |
| Mechanics / autobody demo | `mechanics` | `MechanicLeenaChat` sets `context` on each message POST |
| Salon demo | `salon` | `SalonLeenaChat` sets `context` on each message POST |

Public API: **`POST /api/widget/[widgetKey]/message`** with body `{ message, sessionId?, page?, context? }`.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_RET_WIDGET_KEY` | For `/ret` widget | Same **widget key** as AI Agency → site binding (Generate Widget Key). |
| `NEXT_PUBLIC_SALON_DEMO_WIDGET_KEY` | For `/for-salon-professionals/demo` (LEENA) | **Separate** widget key for the salon demo agent — avoids sharing RET/MAANIA’s key when you want a different agent or knowledge base. Optional `NEXT_PUBLIC_SALON_AGENT_NAME` overrides the default display name (`LEENA`). |
| `NEXT_PUBLIC_INSURANCE_DEMO_WIDGET_KEY` | For `/for-insurance-brokers/demo` (JAH) | **Separate** widget key for the insurance broker demo agent. Optional `NEXT_PUBLIC_INSURANCE_AGENT_NAME` overrides the default display name (`JAH`). Messages send `context.pageType: "insurance"`. |
| `NEXT_PUBLIC_TRANSPORT_DEMO_WIDGET_KEY` | For `/for-transportation-services/demo` (DERRON) | **Separate** widget key for the transportation demo agent. Optional `NEXT_PUBLIC_TRANSPORT_AGENT_NAME` overrides the default display name (`DERRON`). Messages send `context.pageType: "transport"`. |
| `NEXT_PUBLIC_TAX_DEMO_WIDGET_KEY` | For `/for-tax-professionals` and `/for-tax-professionals/demo` (LEDGER) | **Separate** widget key for the tax professional demo agent. Optional `NEXT_PUBLIC_TAX_AGENT_NAME` overrides the default display name (`LEDGER`). Messages send `context.pageType: "tax"`. |
| `NEXT_PUBLIC_BARBERSHOP_DEMO_WIDGET_KEY` | For `/for-barbershops` and `/for-barbershops/demo` (REN) | **Separate** widget key for the barbershop demo agent. Optional `NEXT_PUBLIC_BARBERSHOP_AGENT_NAME` overrides the default display name (`REN`). Messages send `context.pageType: "barbershop"`. |
| `NEXT_PUBLIC_MECHANICS_DEMO_WIDGET_KEY` | For `/for-mechanics` and `/for-mechanics/demo` (TAO) | **Separate** widget key for the mechanics / autobody demo agent. Optional `NEXT_PUBLIC_MECHANICS_AGENT_NAME` overrides the default display name (`TAO`). Messages send `context.pageType: "mechanics"`. |
| `NEXT_PUBLIC_SITE_URL` | Optional | Absolute origin for loading `/widget/loader.js` when it must not rely on `window.location.origin`. |

## Allowed domains

The widget **config** and **message** routes check **Origin / Referer** against the site binding’s **allowed domains**. Include:

- Production app host (e.g. `https://your-app.com`)
- Local dev: `http://localhost:3000` (or your port)

Otherwise the widget returns 403 from the config fetch or message POST.

## Site Builder (marketing)

1. AI Agency: create agent → bind to site → **Generate Widget Key** → add allowed domain(s).
2. In Site Builder **Custom JS**, set config **before** the loader script:

```html
<script>
  window.TROO_AGENT_CONFIG = {
    widgetKey: "YOUR_KEY",
    context: { pageType: "site", source: "sitebuilder", siteSection: "realtor-marketing" }
  };
</script>
<script src="https://YOUR_APP_ORIGIN/widget/loader.js" async></script>
```

3. **Apply** customizations and publish.

## RET (`/ret`)

1. Set `NEXT_PUBLIC_RET_WIDGET_KEY` to the **same** key as the public site (or another agent if you intentionally split).
2. Open `/ret` — the floating widget receives **`retSnapshot`** (curated draft fields) on each message.
3. Draft updates are **debounced (400ms)** so typing doesn’t spam context events.

### Session ids

- **`retClientSessionId`**: per tab, `sessionStorage` — for correlation until a server session exists.
- **`retSessionId`** (future): send only an id; backend loads authoritative intake from DB (safer than trusting browser-only snapshots for compliance).

## Security notes

- Treat **`widgetKey`** like a public embed capability, not a password — domain allowlisting + rate limits apply.
- **`retSnapshot`** is curated (previews, flags) — do not dump unchecked PII into prompts as the form grows.

## Server-backed RET sessions (authoritative intake)

Run SQL migration: `drizzle/ret_sessions.sql` on your database (adds `ret_sessions`). For a **copy-paste block** you can run in the TiDB Cloud SQL editor (same tab or new tab — either is fine), see [`docs/tidb-sql-snippets.md`](./tidb-sql-snippets.md).

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/ret/session` | Yes | Body `{ draft, sessionId? }` — create or update draft; returns `{ sessionId }`. |
| `GET /api/ret/session?id=` | Yes | Load draft for owner. |

The RET page **autosaves** the draft (debounced) when signed in. The widget sends **`retSessionId`** in `context`; **`POST /api/widget/.../message`** loads that session if it belongs to the **same user as the agent** and replaces `retSnapshot` for the model (authoritative).

## Transportation demo (`/for-transportation-services/demo`)

1. Create the transportation agent in **AI Agency**, add fleet- and policy-aware knowledge, then **Generate Widget Key** with this app’s origin allowed.
2. Set `NEXT_PUBLIC_TRANSPORT_DEMO_WIDGET_KEY` to that key.
3. Messages send `context.pageType: "transport"` (see `src/lib/widget/context-prompt.ts`).

## Insurance broker demo (`/for-insurance-brokers/demo`)

1. Create the broker agent in **AI Agency**, add knowledge and compliance-aware prompts, then **Generate Widget Key** with this app’s origin allowed.
2. Set `NEXT_PUBLIC_INSURANCE_DEMO_WIDGET_KEY` to that key.
3. Messages send `context.pageType: "insurance"` (see `src/lib/widget/context-prompt.ts`).

## Tax professional demo (`/for-tax-professionals/demo`)

1. Create the tax professional agent in **AI Agency**, add intake- and scope-aware knowledge, then **Generate Widget Key** with this app’s origin allowed.
2. Set `NEXT_PUBLIC_TAX_DEMO_WIDGET_KEY` to that key.
3. Messages send `context.pageType: "tax"` (see `src/lib/widget/context-prompt.ts`).

## Barbershop demo (`/for-barbershops/demo`)

1. Create the barbershop agent in **AI Agency**, add booking- and policy-aware knowledge, then **Generate Widget Key** with this app’s origin allowed.
2. Set `NEXT_PUBLIC_BARBERSHOP_DEMO_WIDGET_KEY` to that key.
3. Messages send `context.pageType: "barbershop"` (see `src/lib/widget/context-prompt.ts`).

## Mechanics / autobody demo (`/for-mechanics/demo`)

1. Create the mechanics / autobody agent in **AI Agency**, add service- and policy-aware knowledge, then **Generate Widget Key** with this app’s origin allowed.
2. Set `NEXT_PUBLIC_MECHANICS_DEMO_WIDGET_KEY` to that key.
3. Messages send `context.pageType: "mechanics"` (see `src/lib/widget/context-prompt.ts`).

## Salon demo (`/for-salon-professionals/demo`)

1. Create the salon agent in **AI Agency**, add knowledge when ready, and **Generate Widget Key** for a binding that allows this app’s origin.
2. Set `NEXT_PUBLIC_SALON_DEMO_WIDGET_KEY` to that key (do not reuse `NEXT_PUBLIC_RET_WIDGET_KEY` unless you intentionally want the same agent).
3. Messages send `context.pageType: "salon"` so the server prompt matches beauty/salon guest-care behavior (see `src/lib/widget/context-prompt.ts`).

## Files

- `public/widget/loader.js` — embed, `TROO_AGENT_CONFIG`, `troo-agent-context` events
- `src/app/api/widget/[widgetKey]/message/route.ts` — merges `context` into system prompt
- `src/app/api/ret/session/route.ts` — save/load RET drafts
- `src/lib/db/schema.ts` — `retSessions` table
- `src/lib/widget/context-prompt.ts` — mode instructions (site / ret / property_twin)
- `src/lib/ret/agent-context.ts` — `buildRetAgentContext`
- `src/components/ret/RetAgentWidget.tsx` — loads widget on `/ret`, autosave
