# Business Protocol Roadmap

**From Product Features → Digital Business Infrastructure**

This document maps the strategic vision (Business Protocol, Unified Business Graph, Build Challenges, Live Commerce) to the current codebase and identifies implementation gaps.

---

## Executive Summary

| Pillar | Vision | Current State | Gap |
|--------|--------|---------------|-----|
| **Business Protocol** | Expose primitives as programmable API | v1 APIs, SDK, scopes | Add entities, campaigns, workflows as first-class API |
| **Unified Business Graph** | Graph of economic relationships | graph_nodes, graph_edges, event-driven updates | Extend event coverage, add graph query API |
| **Build Challenges** | Recurring entrepreneur challenges with leaderboards | Spring 2026 challenge (skill-based) | Generalize to platform-event-driven challenges |
| **Live Commerce** | 3D commerce nodes in-world | world_commerce_nodes, CommerceNodeLayer, transact | Mostly built; expand node types |

---

## 1. Business Protocol — What Exists

### Developer Portal (`/developers`)
- ✅ API key management (create, list, scopes)
- ✅ Webhook management (URL, events, secret)
- ✅ Event registry (platform_activity, event types)
- ✅ Workflow automations (trigger → actions)

### Platform API v1 (`/api/v1/*`)
| Area | Endpoints | Status |
|------|-----------|--------|
| Worlds | GET worlds, world/:id, commerce, npcs, links | ✅ |
| Apps | GET apps, app/:slug | ✅ |
| Trusts | GET trusts, trust/:id, assets, instruments | ✅ |
| Assets | GET assets, world-assets, purchase | ✅ |
| Workflows | GET workflows, workflow/:id | ✅ |
| Events | GET events, stream (SSE) | ✅ |
| Identity | GET identity, POST wallets | ✅ |
| Agents | GET agents | ✅ |
| Commerce | GET/POST commerce, transact, transactions | ✅ |

### Troo SDK (`packages/troo-sdk`)
- ✅ createWorld, getWorld, getWorlds
- ✅ getWorldLinks, linkWorld
- ✅ getCommerce, transact, getCommerceTransactions
- ✅ getApps, getApp, installApp
- ✅ getAgents, spawnAgent
- ✅ getWorldAssets, purchaseAsset, sellAsset
- ✅ getIdentity, linkWallet
- ✅ listen(eventType, callback, { scope: "public" })

### Scopes
- read/write: trusts, assets, instruments, events, workflows, accounting, worlds, apps, commerce

---

## 2. Unified Business Graph — What Exists

### Schema
- ✅ `graph_nodes` (id, nodeType, refId, metadata)
- ✅ `graph_edges` (fromNodeId, toNodeId, relationType, metadata)

### Event → Graph Hooks (`src/lib/graph/update-graph.ts`)
| Event | Nodes | Edges |
|-------|--------|-------|
| world_published | user, world | OWNS |
| commerce_node_created | user, world, commerce_node | OWNS, LOCATED_IN |
| app_published | user, app | CREATED |
| app_installed | user, app | USES |
| entity_created | user, entity | OWNS |
| asset_purchased | user, asset | OWNS |
| commerce_transaction | user, user | PAYS |

### Gaps
- ❌ No graph query API (e.g. `GET /api/v1/graph?from=user_123&relation=OWNS`)
- ❌ Missing events: `campaign_launched`, `workflow_started`, `agent_performed`, `certificate_issued`, `instrument_issued`
- ❌ No AI/analytics layer on top of graph
- ❌ No `Client` node type; `Service`, `Campaign`, `Workflow` as nodes not wired

---

## 3. Build Challenges — What Exists

### Spring 2026 Entity Build Challenge
- ✅ `challenge_submissions`, `challenge_credits`, `challenge_audit_log`
- ✅ `/challenge/spring-entity-build` — submission flow
- ✅ `/api/challenge/spring-2026/*` — start, answers, submit, apply-credit
- ✅ Skill-based scoring (rubric, phases)

### Gap vs Vision (Entrepreneur Build Challenges)
- ❌ Not driven by platform events (entity_created, world_created, agent_installed, etc.)
- ❌ No generic `challenges` table (reusable for quarterly events)
- ❌ No leaderboard API or public `/challenge` dashboard
- ❌ No automatic progress tracking from `platform_activity`
- ❌ No rewards: TROO tokens, template sales rights, featured placement

---

## 4. Live Commerce — What Exists

### Commerce Nodes
- ✅ `world_commerce_nodes` (id, worldId, ownerId, nodeType, placementJson, title, priceToken, priceUSD, status)
- ✅ Node types: store, service, consultation, ad_space, product_display, event_space, course, npc_service
- ✅ CommerceNodeLayer — 3D markers in world viewer
- ✅ CommercePanel — purchase UI
- ✅ POST transact — records transaction, platform fee, revenue distribution
- ✅ commerce_transaction event → CBG PAYS edge

### Gaps
- ❌ No direct link to `/api/services/purchase`, `/api/agents/activate`, `/api/workflows/start`, `/api/campaigns/launch` from node config
- ❌ Node metadata (serviceId, agentId, workflowId) exists but not fully wired to backend actions
- ❌ No economic districts / platform global zone advertising
- ❌ Token payment flow (currently records amounts; no on-chain/off-chain settlement)

---

## 5. Implementation Priorities

### Phase A: Protocol Completeness (2–4 weeks)
1. **Unified Business API** — Add `POST /api/v1/entities`, `POST /api/v1/campaigns` (if campaigns exist), extend workflow API
2. **Graph Query API** — `GET /api/v1/graph/nodes`, `GET /api/v1/graph/edges?from=...&relation=...`
3. **Extend CBG** — Add graph edges for `certificate_issued`, `instrument_issued`, `campaign_launched`, `workflow_started`
4. **Developer docs** — OpenAPI spec, SDK examples, webhook payload docs

### Phase B: Challenge System (2–3 weeks)
1. **Generic challenges table** — `challenges` (id, name, startDate, endDate, rulesJson, scoringVersion)
2. **Event-driven progress** — `challenge_participants` + `challenge_events`; progress from `platform_activity`
3. **Leaderboard API** — `GET /api/v1/challenges/:id/leaderboard`
4. **Public `/challenge` page** — Dashboard, progress, leaderboard

### Phase C: Commerce Depth (2–3 weeks)
1. **Commerce node actions** — Map nodeType + agentId/serviceId to backend: book consultation, activate agent, start workflow
2. **Platform global zone** — Admin-controlled ad slots, sponsored offices
3. **Token economy** — Wire TROO token for purchases (if token infra exists)

### Phase D: AI Business Advisor (4+ weeks)
1. **Graph analytics** — Queries like "clients acquired from campaigns in world X"
2. **Recommendation engine** — "Users who run Grant Writing Agencies also install Proposal Automation"
3. **AI co-pilot** — Agent that reads graph and suggests improvements

---

## 6. Architecture Notes

### Event System as Graph Ingestion
The existing `emitPlatformEvent` → `updateGraphFromEvent` flow is the right pattern. Extend `update-graph.ts` for each new event type.

### Protocol vs Product
- **Product**: UI, wizards, dashboards — for end users
- **Protocol**: APIs, SDK, webhooks, graph — for developers and automation

The protocol layer should be stable and versioned (`/api/v1`). New product features can ship without breaking the protocol.

### Moat
The Unified Business Graph becomes the moat when:
- Thousands of businesses create entities, worlds, agents, campaigns
- Millions of edges accumulate (OWNS, PAYS, LOCATED_IN, USES, etc.)
- Rebuilding that dataset is prohibitively expensive for competitors

---

## 7. Quick Wins

| Win | Effort | Impact |
|-----|--------|--------|
| Add `campaign_launched`, `workflow_started` to CBG | 1 day | Richer graph |
| Graph query API (read-only, scoped) | 2–3 days | Enables ecosystem tools |
| Public `/challenge` leaderboard | 2 days | Viral growth |
| Commerce node → "Book consultation" action | 1–2 days | Live commerce depth |

---

*Last updated: March 2026*
