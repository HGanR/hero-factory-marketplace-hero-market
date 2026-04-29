# Persistent Activity Layer — Design Spec

**Goal**: Make Troo Town (and any world) feel like a living city by visualizing economic and user activity in real time.

---

## 1. Foundation (Already Built)

| Component | Location | Notes |
|-----------|----------|-------|
| platform_activity | schema, emitPlatformEvent | userId, eventType, payload, createdAt |
| Event stream (SSE) | /api/v1/events/stream | scope=public, eventType filter |
| Commerce nodes | world_commerce_nodes | placementJson → 3D position |
| World viewer | /worlds/[worldId], /troo-town | CommerceNodeLayer, NPCLayer |

**Events with world context** (payload.worldId):
- commerce_node_created
- commerce_transaction
- world_published (worldId = the world itself)

**Platform-wide public events** (no worldId, but visible in "city" view):
- app_published, app_installed
- asset_purchased

---

## 2. Architecture

### Event Flow

```
Platform Event (emitPlatformEvent)
    ↓
platform_activity table
    ↓
World Activity Stream API (filters by worldId / scope)
    ↓
SSE → World Viewer Client
    ↓
ActivityLayer component → 3D effects + HUD feed
```

### World-Scoped Stream

**GET /api/worlds/[worldId]/activity-stream**

- **Auth**: Session or public (for published worlds)
- **Protocol**: Server-Sent Events
- **Filter**: Events where `payload.worldId === worldId` OR platform-wide public events (configurable)
- **Polling**: Same pattern as /api/v1/events/stream (poll DB, no WebSocket infra)

### Event → Visual Mapping

| Event | objectId / Target | Visual Effect |
|-------|-------------------|---------------|
| commerce_transaction | nodeId (commerce node) | Glow pulse, receipt hologram |
| commerce_node_created | worldId (new node position) | Construction spark |
| world_published | worldId | Celebration burst |
| app_installed | — | Generic "activity" indicator |
| asset_purchased | — | Generic "activity" indicator |

---

## 3. Data Model (Optional Enhancement)

### world_activity_events (denormalized, optional)

If we want faster world-scoped queries without scanning platform_activity:

```sql
CREATE TABLE world_activity_events (
  id VARCHAR(36) PRIMARY KEY,
  worldId VARCHAR(36) NOT NULL,
  eventType VARCHAR(100) NOT NULL,
  objectId VARCHAR(120),      -- commerce node id, building id, etc.
  metadata JSON,
  createdAt TIMESTAMP DEFAULT NOW(),
  INDEX (worldId, createdAt)
);
```

**Population**: Trigger or async job when platform_activity is inserted and payload.worldId is set.

**Alternative**: Query platform_activity with `WHERE JSON_EXTRACT(payload, '$.worldId') = ?` — works but slower at scale. For MVP, filtering in application layer after fetch is acceptable.

---

## 4. Client Components

### ActivityFeedHUD

Floating panel showing recent events:

```
┌─────────────────────────────────┐
│ Live Activity                    │
├─────────────────────────────────┤
│ • Service purchased — Grant Co   │
│ • AI agent deployed              │
│ • Campaign launched              │
│ • New business opened            │
└─────────────────────────────────┘
```

### ActivityPulse (3D)

When `commerce_transaction` received with nodeId:
- Resolve node position from commerceNodes
- Trigger brief glow/pulse at that position
- Optional: floating "+$1,200" text

### BuildingActivityIndicator

Per-building or per-zone activity level:
- **Low**: dim
- **Medium**: windows glowing
- **High**: holographic streams

Requires: aggregation of events per building/zone over time window.

---

## 5. Implementation Phases

### Phase 1: Backend + Minimal HUD (1–2 days)
1. **GET /api/worlds/[worldId]/activity-stream** — SSE, filter platform_activity by payload.worldId + public events
2. **useWorldActivityStream(worldId)** — React hook, EventSource
3. **ActivityFeedHUD** — Simple list in world viewer HUD

### Phase 2: 3D Effects ✅
1. **ActivityPulseLayer** — On commerce_transaction, expanding teal ring at commerce node position
2. Pulse animates over ~2.2s (expand + fade), then auto-removes

### Phase 3: Building-Level Activity ✅ (partial)
1. **Commerce node glow** — Nodes with recent transactions show teal emissive glow for 6s
2. `activeNodeIds` prop on CommerceNodeLayer; `recentlyActiveNodeIds` derived from activity stream
3. City heatmap (economic zones) — future

---

## 6. Event Types for Activity Layer

| Event | In Payload | Visual |
|-------|------------|--------|
| commerce_transaction | worldId, nodeId, amountToken, amountUSD | Pulse at node, receipt |
| commerce_node_created | worldId, nodeId | Spark at placement |
| world_published | worldId | Celebration |
| app_installed | — | Generic activity |
| asset_purchased | — | Generic activity |
| entity_created | — | Generic activity |

---

## 7. Psychological Effect

> "Something important is happening here."

Activity signals → perceived value → increased engagement.

---

*Last updated: March 2026*
