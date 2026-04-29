# Venue + Interior Node + Live Room Implementation Plan

## 1. Recommended Architecture

**Decision: Create a new `venue_interior_nodes` table.**

**Why not extend `meeting_node_placements`?**
- `meeting_node_placements` is tightly coupled to `troo_world_placements` via `parentPlacementId` (integer FK).
- World Explorer uses `world_chunk_placements` with JSON placements; placement IDs are client-generated strings (e.g. `pl_1234567890_abc123`).
- Troo World and World Explorer are separate systems; merging would require `parentSystem` + polymorphic parent, increasing complexity.
- A dedicated table keeps Troo meeting nodes untouched and avoids regression.

**Reuse strategy:**
- `user_world_assets` — unchanged; venue assets purchased like any other asset
- `world_chunk_placements` — unchanged; venue placed like any building
- World draft flow — unchanged; ownership validation already in place
- LiveKit token route — unchanged; same token API for all rooms
- `/meet` page — unchanged; same room join flow
- Avatar default — unchanged; `/api/avatars/default` already used by meet page

**New additions:**
- `venue_interior_nodes` table
- `/api/worlds/[worldId]/venue-nodes/*` routes
- `/api/worlds/venue-nodes/entry` (or unified `/api/meet/entry`) for room validation
- World Editor UI: "Add Interior Node" when selected placement is a venue

---

## 2. Phase Plan

### Phase 1: Venue Category Support
**Goal:** Admin can create assets with category `venue`; users can buy and place them.

| Task | Files | Dependencies |
|------|-------|--------------|
| Add `venue` to category options | `src/app/admin/world-assets/page.tsx` | None |
| Add `venue` to catalog filters | `WorldAssetCatalogPanel.tsx`, `OwnedAssetLibrary.tsx` | None |
| Ensure `building` and `venue` both support interior nodes | Phase 4 (UI checks asset category) | Phase 2 |

**Files to edit:**
- `src/app/admin/world-assets/page.tsx` — add `<option value="venue">venue</option>`, add `venue` to filter buttons

---

### Phase 2: DB Schema for Venue Interior Nodes
**Goal:** Table exists; migrations run.

| Task | Files | Dependencies |
|------|-------|--------------|
| Add `venue_interior_nodes` table | `src/lib/db/schema.worlds.ts` | None |
| Create Drizzle migration | `drizzle/` | Phase 2 schema |
| Export types | `schema.worlds.ts` | None |

**Files to create/edit:**
- `src/lib/db/schema.worlds.ts` — add `venueInteriorNodes` table
- `drizzle/XXXX_venue_interior_nodes.sql` — migration

---

### Phase 3: APIs for Create/List/Update/Delete/Entry
**Goal:** Full CRUD + entry validation for venue nodes.

| Task | Files | Dependencies |
|------|-------|--------------|
| List nodes | `src/app/api/worlds/[worldId]/venue-nodes/route.ts` | Phase 2 |
| Create node | Same file, POST | Phase 2 |
| Get single | `src/app/api/worlds/[worldId]/venue-nodes/[nodeId]/route.ts` | Phase 2 |
| Update node | Same file, PATCH | Phase 2 |
| Delete node | Same file, DELETE | Phase 2 |
| Entry validation | `src/app/api/worlds/venue-nodes/entry/route.ts` | Phase 2 |
| roomId helper | `src/lib/venue-nodes/room-id.ts` | None |

**Dependencies:** Phase 2

---

### Phase 4: World Editor UI
**Goal:** User can add, edit, list, activate/deactivate interior nodes on placed venues.

| Task | Files | Dependencies |
|------|-------|--------------|
| Detect venue placement | Editor page, assetMap lookup | Phase 3 |
| "Add Interior Node" button | New `VenueInteriorNodePanel` or extend inspector | Phase 3 |
| Node list per venue | Same component | Phase 3 |
| Create modal | `VenueNodeCreateModal.tsx` | Phase 3 |
| Edit/delete/activate | Same component | Phase 3 |
| "Open room" link | Link to `/meet/[roomId]` | Phase 5 |

**Files to create/edit:**
- `src/components/world-editor/VenueInteriorNodePanel.tsx` (new)
- `src/components/world-editor/VenueNodeCreateModal.tsx` (new)
- `src/app/worlds/[worldId]/edit/page.tsx` — integrate panel when selected placement is venue

**Dependencies:** Phase 3

---

### Phase 5: Meet / LiveKit Integration
**Goal:** Clicking a venue node opens a live room; avatars work.

| Task | Files | Dependencies |
|------|-------|--------------|
| Unified entry route OR venue-specific | `src/app/api/worlds/venue-nodes/entry/route.ts` | Phase 3 |
| `/meet/[roomId]` try venue entry when Troo fails | `src/app/meet/[roomId]/page.tsx` | Phase 3 |
| LiveKit token works for venue roomIds | Already works (roomId is just string) | None |

**Approach:** Extend `/meet/[roomId]` to call venue entry API when Troo entry returns 404. No new route needed for meet page.

**Dependencies:** Phase 3

---

### Phase 6: Optional Node Purchase Gating
**Goal:** User must own a `venue_node` entitlement before creating interior nodes.

| Task | Files | Dependencies |
|------|-------|--------------|
| Add `venue_node` asset category | Admin assets | Phase 1 |
| Check ownership in POST | `venue-nodes/route.ts` | Phase 3 |
| Optional: `remainingNodes` in user_world_assets | Schema extension | Phase 2 |

**Design:** Use existing `user_world_assets` with `assetId` pointing to a `venue_node` asset. On POST, check `user_world_assets` for that asset. If quantity-based, decrement `remainingPlacements`. Skip check if no `venue_node` assets exist (backward compatible).

**Dependencies:** Phase 3, Phase 1

---

### Phase 7: Optional NFT Mint Integration
**Goal:** Future-ready; no implementation now.

| Task | Design only |
|------|-------------|
| What gets minted | World config, or venue+nodes config |
| Metadata JSON shape | See section 8 |
| Where stored | `worlds.nftContractAddress`, `worlds.nftTokenId` |
| Mint = ownership transfer vs certificate | TBD; schema supports both |

**Dependencies:** None for planning; implementation is future work.

---

## 3. Exact Schema Proposal

### Table: `venue_interior_nodes`

```sql
CREATE TABLE venue_interior_nodes (
  id VARCHAR(36) PRIMARY KEY,
  worldId VARCHAR(36) NOT NULL,
  placementId VARCHAR(64) NOT NULL,
  title VARCHAR(120) NOT NULL,
  slug VARCHAR(80),
  nodeType VARCHAR(40) NOT NULL DEFAULT 'voice_room',
  description TEXT,
  posX DECIMAL(12,4) NOT NULL DEFAULT 0,
  posY DECIMAL(12,4) NOT NULL DEFAULT 0,
  posZ DECIMAL(12,4) NOT NULL DEFAULT 0,
  rotY DECIMAL(12,4) NOT NULL DEFAULT 0,
  isActive BOOLEAN NOT NULL DEFAULT true,
  accessType VARCHAR(24) NOT NULL DEFAULT 'public',
  roomId VARCHAR(120) NOT NULL,
  createdByUserId INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX venue_interior_nodes_world_idx (worldId),
  INDEX venue_interior_nodes_placement_idx (worldId, placementId),
  INDEX venue_interior_nodes_room_idx (roomId),
  UNIQUE KEY venue_interior_nodes_room_uidx (roomId)
);
```

**Field details:**
- `id` — UUID, primary key
- `worldId` — FK to `worlds.id` (logical; no DB FK to avoid cross-schema ref if worlds in different DB)
- `placementId` — placement `id` from `world_chunk_placements.placementsJson` (e.g. `pl_1234567890_abc123`)
- `title` — display name
- `slug` — optional URL-safe label
- `nodeType` — enum: `voice_room`, `event_stage`, `seminar_room`, `chat_room`, `concert_hall`, `custom`
- `description` — optional
- `posX`, `posY`, `posZ` — relative to parent venue placement origin
- `rotY` — rotation around Y axis (radians or degrees; use degrees for consistency with placements)
- `isActive` — if false, entry returns 403
- `accessType` — `public`, `private`, `token_gated`, `owner_only`
- `roomId` — `{worldId}:{placementId}:{nodeId}` — unique, used for LiveKit room name
- `createdByUserId` — for audit
- `createdAt`, `updatedAt` — timestamps

**roomId generation:**
```
roomId = `${worldId}:${placementId}:${nodeId}`
```
Example: `abc-world-123:pl_1234567890_xyz:node-uuid-456`

**Indexes:**
- `worldId` — list nodes by world
- `(worldId, placementId)` — list nodes per placement
- `roomId` — entry lookup (unique)

---

## 4. Exact API Design

### `GET /api/worlds/[worldId]/venue-nodes`
**Auth:** Optional (public worlds) or owner
**Query:** `?placementId=...` optional filter
**Response:**
```json
{
  "nodes": [
    {
      "id": "uuid",
      "worldId": "world-uuid",
      "placementId": "pl_123_abc",
      "title": "Main Stage",
      "slug": "main-stage",
      "nodeType": "event_stage",
      "description": "...",
      "posX": 0, "posY": 0, "posZ": 0, "rotY": 0,
      "isActive": true,
      "accessType": "public",
      "roomId": "world:placement:node",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```
**Failure:** 404 if world not found or not published (for public)

---

### `POST /api/worlds/[worldId]/venue-nodes`
**Auth:** Required (owner or admin)
**Body:**
```json
{
  "placementId": "pl_123_abc",
  "title": "Main Stage",
  "slug": "main-stage",
  "nodeType": "event_stage",
  "description": "Optional",
  "posX": 0, "posY": 0, "posZ": 0, "rotY": 0,
  "accessType": "public"
}
```
**Validation:**
- placementId must exist in world draft chunks
- placement's assetId must have category `venue` or `building` (configurable)
- title required, 1–120 chars
- nodeType must be in allowed enum
**Response:** 201 + created node object
**Failure:** 400 validation, 403 not owner, 404 world/placement not found

---

### `GET /api/worlds/[worldId]/venue-nodes/[nodeId]`
**Auth:** Optional
**Response:** Single node object
**Failure:** 404

---

### `PATCH /api/worlds/[worldId]/venue-nodes/[nodeId]`
**Auth:** Required (owner or admin)
**Body:** Partial update (title, slug, nodeType, description, posX/Y/Z, rotY, isActive, accessType)
**Response:** Updated node object
**Failure:** 400, 403, 404

---

### `DELETE /api/worlds/[worldId]/venue-nodes/[nodeId]`
**Auth:** Required (owner or admin)
**Response:** 204 No Content
**Failure:** 403, 404

---

### `GET /api/worlds/venue-nodes/entry?roomId=...`
**Auth:** None (public validation)
**Query:** `roomId` = `{worldId}:{placementId}:{nodeId}`
**Validation:**
- Parse roomId (3 parts)
- Look up node by id
- Check isActive
- Check world is published (optional)
**Response:**
```json
{
  "ok": true,
  "redirectUrl": "https://origin/meet?room=...&name=...",
  "title": "Main Stage"
}
```
**Failure:** 400 invalid format, 404 not found, 403 disabled

---

## 5. World Editor UI Plan

**When placement selected:**
1. Get `assetId` from selected placement
2. Look up `assetMap[assetId]` or fetch asset; check `category === 'venue' || category === 'building'`
3. If venue/building: show "Venue Interior Nodes" panel/section

**Panel content:**
- List of nodes for this placement (fetch `GET /api/worlds/[worldId]/venue-nodes?placementId=...`)
- "Add Interior Node" button
- Per node: title, nodeType, isActive badge, Edit, Delete, "Open room" link

**Add flow:**
- Click "Add Interior Node" → open modal
- Modal: title (required), nodeType dropdown, description, posX/Y/Z (default 0), accessType
- On save → POST to venue-nodes API
- Refresh list

**Edit flow:**
- Click Edit on node → same modal pre-filled
- PATCH on save

**Activation:**
- Toggle isActive in list or edit modal
- PATCH `{ isActive: false }`

**Open room:**
- Link to `/meet/{roomId}` — same as Troo; entry validation will work once Phase 5 wired

**Files to modify:**
- `src/app/worlds/[worldId]/edit/page.tsx` — add state for venueNodes, fetch when placement selected and is venue, render VenueInteriorNodePanel
- New: `VenueInteriorNodePanel.tsx`, `VenueNodeCreateModal.tsx`

---

## 6. Meet / LiveKit Integration Plan

**Approach: Reuse `/meet/[roomId]` and add venue entry fallback.**

**Current flow:**
- `/meet/[roomId]` calls `GET /api/troo-world/meeting-nodes/entry?roomId=...`
- Troo returns 404 if not a Troo room
- On success, redirects to `/meet?room=...&name=...`

**New flow:**
1. Call Troo entry API first
2. If 404 (or 400 invalid format for Troo), call `GET /api/worlds/venue-nodes/entry?roomId=...`
3. If venue returns ok, redirect same way
4. If both fail, show error

**roomId format detection:**
- Troo: `worldId:nodeId` (2 parts)
- Venue: `worldId:placementId:nodeId` (3 parts)
- Troo entry can return 400 for 3-part format; then we try venue

**Avatar:** No change. Meet page already fetches `/api/avatars/default`. Same for venue rooms.

**LiveKit:** Room name = roomId. Token API accepts any room name. No changes needed.

**File to edit:**
- `src/app/meet/[roomId]/page.tsx` — add fallback to venue entry when Troo returns 404

---

## 7. Optional Node Purchase Gating

**Design: Asset-based entitlement.**

1. Add `venue_node` to `world_library_assets` categories
2. Admin creates a "Venue Interior Node" asset with tokenPrice (or 0)
3. User purchases it like any asset → `user_world_assets` row
4. On POST to venue-nodes:
   - If no `venue_node` assets exist in catalog: skip check (backward compatible)
   - If exists: require user to own at least one `venue_node` asset
   - Optional: `licenseScope === 'quantity_based'` → decrement `remainingPlacements` on create

**Enforcement:** In `POST /api/worlds/[worldId]/venue-nodes`, before insert:
```ts
const venueNodeAssets = await db.select().from(worldLibraryAssets)
  .where(and(eq(category, 'venue_node'), eq(status, 'published')));
if (venueNodeAssets.length > 0) {
  const owned = await db.select().from(userWorldAssets)
    .where(and(eq(userId, auth.userId), inArray(assetId, venueNodeAssets.map(a => a.id))));
  if (owned.length === 0) return 403 "Purchase a Venue Node entitlement first";
}
```

---

## 8. Optional NFT Plan

**What could be minted (future):**
1. **World configuration** — entire world + placements + venue nodes as JSON in metadata
2. **Venue placement + nodes** — single venue and its interior nodes
3. **Ownership transfer** — mint transfers world/venue to new owner
4. **Certificate** — mint proves ownership without transfer

**Metadata JSON shape (example):**
```json
{
  "name": "My Concert Hall World",
  "description": "...",
  "worldId": "uuid",
  "version": 1,
  "placements": [...],
  "venueNodes": [...],
  "thumbnailUrl": "..."
}
```

**Storage:** `worlds.nftContractAddress`, `worlds.nftTokenId` already exist. Mint API would:
1. Upload metadata to IPFS
2. Call mint contract with tokenURI
3. PATCH world with contract address + tokenId

**No implementation now** — architecture is ready.

---

## 9. Exact File-Level TODO List

### Phase 1
- [ ] `src/app/admin/world-assets/page.tsx` — add venue option, filter button

### Phase 2
- [ ] `src/lib/db/schema.worlds.ts` — add venueInteriorNodes table
- [ ] `drizzle/XXXX_venue_interior_nodes.sql` — migration
- [ ] `package.json` — run migration script if needed

### Phase 3
- [ ] `src/lib/venue-nodes/room-id.ts` — buildRoomId, parseRoomId helpers
- [ ] `src/lib/venue-nodes/validators.ts` — Zod schemas
- [ ] `src/app/api/worlds/[worldId]/venue-nodes/route.ts` — GET, POST
- [ ] `src/app/api/worlds/[worldId]/venue-nodes/[nodeId]/route.ts` — GET, PATCH, DELETE
- [ ] `src/app/api/worlds/venue-nodes/entry/route.ts` — GET

### Phase 4
- [ ] `src/components/world-editor/VenueInteriorNodePanel.tsx`
- [ ] `src/components/world-editor/VenueNodeCreateModal.tsx`
- [ ] `src/app/worlds/[worldId]/edit/page.tsx` — integrate panel

### Phase 5
- [ ] `src/app/meet/[roomId]/page.tsx` — venue entry fallback

### Phase 6 (optional)
- [ ] `src/app/admin/world-assets/page.tsx` — add venue_node category
- [ ] `src/app/api/worlds/[worldId]/venue-nodes/route.ts` — add entitlement check

### Phase 7 (future)
- [ ] Mint API, contract, metadata pipeline

---

## 10. Naming Convention

**Recommendation: `venue_interior_nodes`**

Alternatives considered:
- `world_venue_nodes` — emphasizes world scope
- `placement_interior_nodes` — emphasizes parent placement
- `venue_nodes` — shorter but could confuse with commerce nodes

**Final:** `venue_interior_nodes` — clear that these are interior nodes inside venues.
