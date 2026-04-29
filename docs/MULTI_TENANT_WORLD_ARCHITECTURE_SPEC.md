# Multi-Tenant World Architecture — Technical Spec (v2)

Cursor-ready implementation spec for converting Green Terrain into a multi-tenant user world builder with platform-owned global zones, asset marketplace, token economy, and advertising system.

---

## 0. Platform Global Zone — Core Concept

**Admin owns reserved space (cubits) in every user world.**

When a user creates or visits a world, the platform injects a **Platform Layer** — objects placed by admin that appear in all worlds. Admin edits the global zone once; changes propagate everywhere.

| Use Case | Implementation |
|----------|----------------|
| Welcome Center | Admin places in platform zone → appears in every world |
| Platform HQ | Same |
| Advertising panels | Defined ad slots in platform zones |
| Marketplace kiosks | Platform-owned kiosks in every world |
| Teleport portals | Platform-controlled portals (Explore Worlds) |

**Critical upgrade:** Support **multiple platform zones** (welcome_center, marketplace_hub, advertising_ring, teleport_portal, event_stage), not a single row.

---

## 1. Ownership Model

| Layer | Owner | Scope | Editable By |
|-------|-------|-------|-------------|
| **Platform Layer** | Admin (platform) | Multiple zones, injected into every user world | Admin only |
| **User Layer** | World owner | Per-world | World owner |
| **Reserved Zones** | Platform/system | Block user placement | N/A |

---

## 2. Database Schema (Full)

### 2.1 Worlds

```sql
CREATE TABLE worlds (
  id VARCHAR(36) PRIMARY KEY,
  ownerId INT NOT NULL,
  workspaceId VARCHAR(36) NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  visibility ENUM('private','public','unlisted','token_gated') DEFAULT 'private',
  terrainSeed INT NOT NULL DEFAULT 42,
  biomeType VARCHAR(40) NOT NULL DEFAULT 'green-terrain',
  status ENUM('draft','published','archived') DEFAULT 'draft',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_worlds_owner (ownerId),
  INDEX idx_worlds_visibility (visibility),
  INDEX idx_worlds_status (status)
);
```

### 2.2 World Versions

```sql
CREATE TABLE world_versions (
  id VARCHAR(36) PRIMARY KEY,
  worldId VARCHAR(36) NOT NULL,
  versionType ENUM('draft','published') NOT NULL,
  versionNumber INT NOT NULL DEFAULT 1,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_world_versions_world (worldId),
  INDEX idx_world_versions_type (worldId, versionType)
);
```

### 2.3 World Chunk Placements

```sql
CREATE TABLE world_chunk_placements (
  id VARCHAR(36) PRIMARY KEY,
  worldVersionId VARCHAR(36) NOT NULL,
  chunkKey VARCHAR(20) NOT NULL,
  placementsJson JSON NOT NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_chunk_world (worldVersionId),
  INDEX idx_chunk_key (worldVersionId, chunkKey)
);
```

Placement object shape:
```json
{
  "id": "obj_123",
  "assetId": "bench_modern_01",
  "position": [12.2, 0, -9.1],
  "rotation": [0, 1.57, 0],
  "scale": [1, 1, 1],
  "ownerLayer": "user"
}
```

Platform placement:
```json
{
  "id": "plat_001",
  "assetId": "welcome_center",
  "position": [0, 0, 0],
  "rotation": [0, 0, 0],
  "scale": [1, 1, 1],
  "ownerLayer": "platform"
}
```

### 2.4 Platform Global Zones (Multiple)

```sql
CREATE TABLE platform_global_zones (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  boundsJson JSON NOT NULL,
  placementsJson JSON NOT NULL,
  npcsJson JSON NULL,
  isActive BOOLEAN DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_platform_zones_active (isActive)
);
```

boundsJson shape:
```json
{
  "centerX": 0,
  "centerZ": 0,
  "width": 32,
  "length": 32,
  "heightLimit": 100
}
```

Example zones: `welcome_center`, `marketplace_hub`, `advertising_ring`, `teleport_portal`, `event_stage`

### 2.5 Platform Global Zone Versions

```sql
CREATE TABLE platform_global_zone_versions (
  id VARCHAR(36) PRIMARY KEY,
  zoneId VARCHAR(36) NOT NULL,
  versionNumber INT NOT NULL,
  versionType ENUM('draft','published') NOT NULL,
  placementsJson JSON NOT NULL,
  npcsJson JSON NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_zone_versions_zone (zoneId),
  INDEX idx_zone_versions_type (zoneId, versionType)
);
```

Benefits: rollback, A/B testing, seasonal events.

### 2.6 World Reserved Zones

```sql
CREATE TABLE world_reserved_zones (
  id VARCHAR(36) PRIMARY KEY,
  worldId VARCHAR(36) NULL,
  zoneType ENUM('platform','system','road','spawn') NOT NULL,
  boundsJson JSON NOT NULL,
  sourceZoneId VARCHAR(36) NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_reserved_world (worldId),
  INDEX idx_reserved_type (zoneType)
);
```

**Editor logic:** If placement intersects reserved zone → deny placement.

### 2.7 World Library Assets

```sql
CREATE TABLE world_library_assets (
  id VARCHAR(36) PRIMARY KEY,
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60) NOT NULL,
  description TEXT NULL,
  status ENUM('draft','published','archived') DEFAULT 'draft',
  version INT NOT NULL DEFAULT 1,
  modelUrl VARCHAR(512) NOT NULL,
  previewImageUrl VARCHAR(512) NULL,
  manifestUrl VARCHAR(512) NULL,
  collisionType ENUM('none','box','capsule','hull') DEFAULT 'box',
  instancable BOOLEAN DEFAULT FALSE,
  lodProfile VARCHAR(40) NULL,
  boundsJson JSON NULL,
  tokenPrice INT NOT NULL DEFAULT 0,
  supplyLimit INT NULL,
  isPlatformOnly BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  metadataJson JSON NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_assets_category (category),
  INDEX idx_assets_status (status),
  INDEX idx_assets_active (isActive)
);
```

`isPlatformOnly`: Welcome Center, ad boards, HQ — never user-purchasable.

### 2.8 User World Assets (Ownership)

```sql
CREATE TABLE user_world_assets (
  id VARCHAR(36) PRIMARY KEY,
  userId INT NOT NULL,
  workspaceId VARCHAR(36) NULL,
  assetId VARCHAR(36) NOT NULL,
  licenseScope ENUM('all_worlds_owned','one_world','quantity_based') DEFAULT 'all_worlds_owned',
  remainingPlacements INT NULL,
  purchaseTx VARCHAR(128) NULL,
  purchasedAt TIMESTAMP DEFAULT NOW(),
  createdAt TIMESTAMP DEFAULT NOW(),
  INDEX idx_user_assets_user (userId),
  INDEX idx_user_assets_asset (assetId)
);
```

**Ownership rule (MVP):** One-time purchase, unlimited placement across all worlds owned by user/workspace.

### 2.9 World NPCs

```sql
CREATE TABLE world_npcs (
  id VARCHAR(36) PRIMARY KEY,
  worldId VARCHAR(36) NOT NULL,
  agentId VARCHAR(80) NOT NULL,
  buildingId VARCHAR(36) NULL,
  placementJson JSON NOT NULL,
  role VARCHAR(80) NULL,
  voiceProfile VARCHAR(80) NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_world_npcs_world (worldId)
);
```

### 2.10 Platform Ad Slots

```sql
CREATE TABLE platform_ad_slots (
  id VARCHAR(36) PRIMARY KEY,
  zoneId VARCHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  placementJson JSON NOT NULL,
  adType ENUM('billboard','video','kiosk','npc_sponsor','banner') NOT NULL,
  priceToken INT NULL,
  currentAdvertiser VARCHAR(128) NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW() ON UPDATE NOW(),
  INDEX idx_ad_slots_zone (zoneId)
);
```

Example pricing: Main plaza billboard 50,000 tokens/month, teleport sponsor 100,000 tokens/month.

---

## 3. Rendering Model

**Merge order (critical for performance and correctness):**

1. **Terrain** (procedural from seed)
2. **Platform Global Zones** (locked, non-editable)
3. **User World Objects**
4. **NPCs** (runtime)
5. **Transient UI**

**Client load sequence:**
```
GET /api/worlds/platform-zone
GET /api/worlds/[worldId]/data
GET /api/worlds/[worldId]/npcs
```

Renderer merges into one scene. Platform objects are locked; user cannot move or delete them.

---

## 4. Asset Pipeline (Roblox-Style)

### 4.1 Ingestion

Admin uploads: `.glb` / `.gltf`, preview image, metadata.

Admin fields: name, category, token price, collision type, instancable, lod profile, bounds, tags.

### 4.2 Processing (On Publish)

- Compressed GLB (Draco/Meshopt)
- Preview thumbnail
- Collision proxy
- Optional LOD variants (high/med/low)
- Manifest JSON

### 4.3 Manifest Example

```json
{
  "assetId": "bench_modern_01",
  "version": 3,
  "category": "furniture",
  "modelUrl": "https://cdn.example.com/assets/bench_modern_01/v3/model.glb",
  "previewImageUrl": "https://cdn.example.com/assets/bench_modern_01/v3/preview.jpg",
  "collisionType": "box",
  "instancable": true,
  "lod": {
    "high": "https://cdn.example.com/assets/bench_modern_01/v3/high.glb",
    "medium": "https://cdn.example.com/assets/bench_modern_01/v3/med.glb",
    "low": "https://cdn.example.com/assets/bench_modern_01/v3/low.glb"
  },
  "bounds": { "x": 2.4, "y": 1.1, "z": 0.8 }
}
```

### 4.4 Client Cache

- Cache key: `assetId:version`
- Same asset in many worlds loads once
- Re-fetch only when version changes

### 4.5 Instancing Rules

**Instance:** trees, grass, rocks, benches, lamp posts, ad kiosks, common furniture.

**Do not instance:** unique buildings, animated NPC meshes, hero objects.

Group by: assetId, material variant, lod tier → render as InstancedMesh.

### 4.6 Collision Proxies

Use simplified collision: box, capsule, convex hull, none. Never full mesh by default.

### 4.7 CDN-First Delivery

All published assets on CDN/object storage. APIs return metadata and URLs, not stream files.

---

## 5. Routes

| Route | Purpose |
|-------|---------|
| `/worlds` | World Explorer |
| `/worlds/[worldId]` | View published world |
| `/worlds/[worldId]/edit` | Edit world (owner) |
| `/world-marketplace` | Asset marketplace |
| `/admin/global-zone` | Edit platform zones |
| `/admin/world-assets` | Manage asset library |
| `/admin/ad-slots` | Manage ad slots |

---

## 6. APIs

### 6.1 World APIs

```
GET  /api/worlds                    → List public worlds (explorer)
POST /api/worlds                    → Create world
GET  /api/worlds/me                 → My worlds
GET  /api/worlds/[worldId]          → World metadata
GET  /api/worlds/[worldId]/data     → Placements, chunks, reserved zones
PUT  /api/worlds/[worldId]/draft    → Save draft
POST /api/worlds/[worldId]/publish  → Publish draft
GET  /api/worlds/[worldId]/npcs     → NPC placements
GET  /api/worlds/[worldId]/chunk/[chunkKey] → Chunk placements (streaming)
```

### 6.2 Platform Zone APIs

```
GET  /api/worlds/platform-zone           → All active published zones (public, cacheable)
PUT  /api/admin/worlds/platform-zone     → Update zone draft
POST /api/admin/worlds/platform-zone/publish → Publish zone version
```

### 6.3 Asset APIs

```
GET  /api/world-assets                 → Marketplace assets
GET  /api/world-assets/me               → Owned assets
GET  /api/world-assets/[assetId]       → Asset detail + manifest
POST /api/world-assets/purchase        → Purchase with token
GET  /api/admin/world-assets           → All assets (admin)
POST /api/admin/world-assets           → Create draft asset
PUT  /api/admin/world-assets/[id]      → Update asset
POST /api/admin/world-assets/[id]/publish → Publish asset
```

---

## 7. Editor Rules

### 7.1 World Editor (`/worlds/[worldId]/edit`)

- Place only owned assets (`/api/world-assets/me`)
- **Block placement** if object intersects reserved zone
- Actions: place, move, rotate, scale, delete, undo, redo, grid snap
- Save to draft; publish to public
- Platform zone objects: read-only, cannot edit

### 7.2 Platform Zone Editor (`/admin/global-zone`)

- Edit zone placements
- 3D preview
- Publish new version
- Changes affect all worlds automatically

---

## 8. Event Integration

| Event | When |
|-------|------|
| `world_created` | User creates world |
| `world_published` | User publishes |
| `asset_purchased` | User buys asset |
| `object_placed` | On save (batch) |
| `npc_added` | User places NPC |
| `platform_zone_updated` | Admin publishes zone |
| `platform_ad_slot_created` | Admin creates ad slot |
| `platform_ad_placed` | Advertiser places ad |
| `world_asset_uploaded` | Admin uploads asset |
| `world_asset_published` | Admin publishes asset |

Wire to: `/platform/events`, `/workflows`, `/developers/events`, webhooks.

---

## 9. Chunk Key Convention

- Chunk size: 64m x 64m (or 32m, 128m configurable)
- `chunkKey = floor(x/size)_floor(z/size)`
- Example: (100, 0, -50) with 64m → `"1_-1"`

---

## 10. Teleport Portal

Add teleport portal in platform zone: "Explore Worlds" → `/worlds` explorer. Keeps traffic in platform-controlled space and increases ad value.

---

## 11. Cursor Implementation Checklist

### Phase 1 — Foundation
- [ ] Create all DB tables (worlds, world_versions, world_chunk_placements, platform_global_zones, platform_global_zone_versions, world_reserved_zones, world_library_assets, user_world_assets, world_npcs, platform_ad_slots)
- [ ] `GET /api/worlds/platform-zone`
- [ ] `GET /api/worlds/[worldId]/data`
- [ ] Shared viewer `/worlds/[worldId]` (merge platform + user layers)
- [ ] World creation, draft/published versions

### Phase 2 — Editor
- [ ] `/worlds/[worldId]/edit` with placement, reserved zone blocking
- [ ] `PUT /api/worlds/[worldId]/draft`
- [ ] `POST /api/worlds/[worldId]/publish`
- [ ] Ownership check (owned assets only)

### Phase 3 — Marketplace
- [ ] `world_library_assets` + admin publish flow
- [ ] `user_world_assets` + `GET /api/world-assets/me`
- [ ] `POST /api/world-assets/purchase` (token flow)
- [ ] `/world-marketplace` UI

### Phase 4 — Platform Zone Admin
- [ ] `/admin/global-zone` editor
- [ ] Platform zone versioning (draft/publish)
- [ ] Reserved zone collision/blocking
- [ ] `/admin/ad-slots` (scaffold or full)

### Phase 5 — Performance
- [ ] Chunk-based placement loading
- [ ] Instanced rendering for repeated objects
- [ ] Asset cache (assetId:version)
- [ ] LOD, collision proxies (scaffold)

### Phase 6 — Migration
- [ ] Seed platform zones from Green Terrain
- [ ] Migrate troo-town to worlds
- [ ] Redirect `/troo-town` → `/worlds/troo-town`
- [ ] Deprecate `/green-terrain`

---

## 12. Build Order (Recommended)

1. **Phase 1:** Asset registry + manifest pipeline, world_library_assets, admin publish flow
2. **Phase 2:** Ownership + marketplace, user_world_assets, token purchase, owned assets query
3. **Phase 3:** Shared viewer + draft/published world versions, `/worlds/[worldId]`, `/worlds/[worldId]/edit`
4. **Phase 4:** Chunk placements + instancing, world_chunk_placements, chunk loader, instanced groups
5. **Phase 5:** Platform global zones + reserved bounds, platform_global_zones, reserved zone blocking, admin editor
6. **Phase 6:** LOD, collision proxies, cache versioning

---

## 13. Ownership Rule (Locked)

**When a user buys an asset, they get a one-time purchase license with unlimited placement across all worlds owned by that user/workspace.**

- No resale yet
- No quantity limits yet
- No NFT transfer yet

---

## 14. Drizzle Schema

Drizzle definitions live in `src/lib/db/schema.worlds.ts` and are included in `drizzle.config.ts`. Run `npx drizzle-kit generate` to create migrations.

---

## 15. File Structure

```
src/app/
  worlds/
    page.tsx
    [worldId]/
      page.tsx
      edit/
        page.tsx
  world-marketplace/
    page.tsx
  admin/
    global-zone/
      page.tsx
    world-assets/
      page.tsx
    ad-slots/
      page.tsx

src/lib/
  world-engine/
    terrain.ts
    chunk-loader.ts
    platform-zone.ts
    instanced-renderer.ts
  world-api/
```

---

## 16. Strategic Result

User Worlds + Admin Platform Zones + Token Asset Marketplace + AI Agent Economy + Advertising Network = Digital economic infrastructure.
