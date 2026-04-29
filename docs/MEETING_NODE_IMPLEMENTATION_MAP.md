# Meeting Node & Business-in-a-Box Implementation Map

This document maps the **Corporate Meeting Node MVP** spec to the hero-market Next.js codebase. It provides exact file paths, schema names, API routes, and component names for implementation.

---

## Project Scope (Troo-Focused)

**Oasis is being phased out.** Focus is exclusively on:

| Area | Purpose |
|------|---------|
| **Troo World** | Admin-editable 3D world (`/troo-world`, `/modeling`) |
| **Troo Town** | User-facing experience (`/troo-town`, worldId `green-terrain`) |
| **Green Terrain** | World with Nexus, Meridian, Apex, Harborview buildings (`/green-terrain` admin editor) |
| **World Manager** | Admin: placements, elements, NPCs, meeting nodes (`/modeling`, `/admin/*`) |
| **World Explorer** | User: browse and create worlds (`/worlds`) |
| **Create World** | User flow to create new worlds |
| **Asset Library** | Admin provides buildings + meeting nodes; users purchase via TROO |
| **Node Purchase** | User buys meeting nodes from asset library to place in purchased buildings |

**Flow**: Admin → Asset Library → User purchases buildings & nodes → User places in worlds.

---

## Architecture Summary

| Layer | Purpose | Existing vs New |
|-------|---------|-----------------|
| **World NFT** | Ownership, edit rights, transfer | New (Phase 5) |
| **World Builder** | Placements, nodes, NPCs | Partially exists |
| **Avatar Profile** | Cross-world identity, appearance | New (Phase 2) |
| **Meeting Node** | Room capability, placement | New (Phase 1) |
| **Realtime Room** | Presence, voice, session | New (Phase 3) |

**Recommended first build**: Troo World + meeting node attachment + avatar-aware room entry.

---

## Phase 1: Meeting Node MVP (Troo World Only)

### 1.1 Database Schema

**New tables** in `src/lib/db/schema.ts` or `src/lib/db/schema.worlds.ts`:

```ts
// meeting_node_placements — attaches node to building placement
export const meetingNodePlacements = mysqlTable("meeting_node_placements", {
  id: varchar("id", { length: 36 }).primaryKey(),
  worldId: varchar("worldId", { length: 64 }).notNull(),
  parentPlacementId: int("parentPlacementId").notNull(), // troo_world_placements.id
  parentSystem: varchar("parentSystem", { length: 24 }).default("troo_placement").notNull(),
  nodeAssetKey: varchar("nodeAssetKey", { length: 80 }).default("corporate_meeting_node_v1").notNull(),
  roomId: varchar("roomId", { length: 80 }).notNull(), // `${worldId}:${id}` for realtime
  title: varchar("title", { length: 120 }).notNull(),
  accessType: mysqlEnum("accessType", ["public", "private", "invite_only"]).default("public").notNull(),
  capacity: int("capacity").default(12).notNull(),
  webEnabled: boolean("webEnabled").default(true).notNull(),
  webxrEnabled: boolean("webxrEnabled").default(false).notNull(),
  vrEnabled: boolean("vrEnabled").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  posX: decimal("posX", { precision: 12, scale: 4 }).notNull(),
  posY: decimal("posY", { precision: 12, scale: 4 }).notNull(),
  posZ: decimal("posZ", { precision: 12, scale: 4 }).notNull(),
  rotY: decimal("rotY", { precision: 12, scale: 4 }).default("0").notNull(),
  scale: decimal("scale", { precision: 12, scale: 4 }).default("1").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  worldIdx: index("meeting_node_placements_world_idx").on(table.worldId),
  parentIdx: index("meeting_node_placements_parent_idx").on(table.parentPlacementId),
  roomIdx: index("meeting_node_placements_room_idx").on(table.roomId),
}));
```

**Migration**: Add Drizzle migration for `meeting_node_placements`.

---

### 1.2 Asset Library: Meeting Node

**Option A**: Add to `world_library_assets` with `category: "meeting_node"`.

- **File**: `src/lib/db/schema.worlds.ts` — `worldLibraryAssets` already supports `category`, `metadataJson`.
- **Admin UI**: `src/app/admin/world-assets/page.tsx` — add category filter for `meeting_node`.
- **Seed asset**: Create `corporate_meeting_node_v1` via admin or seed script.

**Option B**: Dedicated meeting node asset table (simpler for v1).

```ts
// meeting_node_assets — catalog of node types
export const meetingNodeAssets = mysqlTable("meeting_node_assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  modelUrl: varchar("modelUrl", { length: 512 }),
  iconUrl: varchar("iconUrl", { length: 512 }),
  compatibleBuildingCategories: text("compatibleBuildingCategories"), // JSON ["corporate","office"]
  minCapacity: int("minCapacity").default(2).notNull(),
  maxCapacity: int("maxCapacity").default(50).notNull(),
  supportedModes: text("supportedModes"), // JSON ["web","webxr","vr"]
  tokenPrice: int("tokenPrice").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

**Recommendation**: Use `world_library_assets` with `category: "meeting_node"` for consistency with existing asset flow. Add `metadataJson` for `compatibleBuildingCategories`, `minCapacity`, `maxCapacity`.

---

### 1.3 API Routes

| Route | Method | Purpose | File |
|-------|--------|---------|------|
| `/api/troo-world/meeting-nodes` | GET | List nodes for world | `src/app/api/troo-world/meeting-nodes/route.ts` |
| `/api/troo-world/meeting-nodes` | POST | Create node (attach to placement) | same |
| `/api/troo-world/meeting-nodes/[nodeId]` | GET | Get node config | `src/app/api/troo-world/meeting-nodes/[nodeId]/route.ts` |
| `/api/troo-world/meeting-nodes/[nodeId]` | PATCH | Update node config | same |
| `/api/troo-world/meeting-nodes/[nodeId]` | DELETE | Remove node | same |
| `/api/meeting-nodes/[roomId]/join` | POST | Resolve room, return join URL | `src/app/api/meeting-nodes/[roomId]/join/route.ts` |
| `/api/world-assets` | GET | Extend to filter `category=meeting_node` | `src/app/api/world-assets/route.ts` (existing) |

**Auth**: Use `requireUserId` from `@/lib/auth` for create/update/delete. Public GET for published worlds.

---

### 1.4 World Builder Integration (Troo World)

**Existing files to modify**:

| File | Changes |
|------|---------|
| `src/components/troo-world/WorldInspector.tsx` | Add "Add Meeting Node" when target is building placement |
| `src/components/troo-world/TrooWorldEditor.tsx` | Add meeting node placement mode, save to API |
| `src/components/troo-world/TrooWorldUnifiedViewer.tsx` | Render node gizmos, handle click → interaction card |

**New components**:

| Component | Path | Purpose |
|-----------|------|---------|
| `MeetingNodeConfigModal` | `src/components/troo-world/MeetingNodeConfigModal.tsx` | Room name, capacity, access, modes |
| `MeetingNodeGizmo` | `src/components/troo-world/MeetingNodeGizmo.tsx` | 3D floor marker / terminal in scene |
| `MeetingNodeInteractionCard` | `src/components/troo-world/MeetingNodeInteractionCard.tsx` | "Enter Meeting", "Copy Invite", participant count |

**WorldInspector hook**:

- When `target.kind === "placement"` and placement is enterable building (nexus, meridian, apex, harborview):
  - Show "Add Meeting Node" button
  - On click → open `MeetingNodeConfigModal`
  - On save → POST `/api/troo-world/meeting-nodes` with `parentPlacementId`, transform

**TrooWorldUnifiedViewer hook**:

- Fetch meeting nodes for current world: `GET /api/troo-world/meeting-nodes?worldId=default`
- For each node, render `MeetingNodeGizmo` at `(posX, posY, posZ)` relative to parent building
- On click → show `MeetingNodeInteractionCard` overlay
- "Enter Meeting" → navigate to `/meet/[roomId]` or dedicated room route

---

### 1.5 Room Entry Route

| Route | File | Purpose |
|-------|------|---------|
| `/meet/[roomId]` | `src/app/meet/[roomId]/page.tsx` | Dedicated meeting room scene (Option B: portal) |

**Existing**: `src/app/meet/page.tsx` exists. Add dynamic `[roomId]` route.

**Room ID format**: `{worldId}:{nodeId}` (e.g. `default:abc-123`).

**Page logic**:

1. Parse `roomId` → `worldId`, `nodeId`
2. Fetch node config from `GET /api/troo-world/meeting-nodes/[nodeId]`
3. Load boardroom scene (reuse or create `MeetingRoomScene.tsx`)
4. Integrate with existing `TrooVideoMeeting` or placeholder "Room loading" until Phase 3

---

### 1.6 Node Visual Asset

**First asset**: `corporate_meeting_node_v1`

- **Visual**: Floor disk, holographic ring, or boardroom terminal
- **Options**:
  1. Procedural (Three.js) — no GLB, build in code like `buildApexExterior`
  2. Simple GLB — upload via admin world-assets, category `meeting_node`
  3. Placeholder — colored cylinder/disk until asset ready

**File**: `src/lib/troo-world/meeting-node/MeetingNodeModel.ts` — export `buildMeetingNodeGizmo(): THREE.Group`

---

## Phase 1.5: Hardening & Usability (Completed)

### Hardening

| Item | Implementation |
|------|----------------|
| Eligible buildings only | API POST validates `parentElementKey` ∈ {nexus-tower, meridian-tower, apex-tower, harborview-tower} |
| Auth for create/patch/delete | `requireAdminOrAuth` on POST, PATCH, DELETE |
| Parent building deletion | Admin placements PUT cascade-deletes `meeting_node_placements` when placement removed |
| Room entry validation | `GET /api/troo-world/meeting-nodes/entry?roomId=...` validates node exists + isActive server-side |
| Graceful failure | `/meet/[roomId]` shows error UI for missing/inactive nodes |

### Usability

| Item | Implementation |
|------|----------------|
| Toast on Copy Invite | `toast.success()` from sonner |
| Node status badge | Active/Inactive badge on `MeetingNodeInteractionCard` |
| Participant count | LiveKit `listParticipants` on interaction card |
| Edit Meeting Node | Inspector lists nodes per building; Edit opens `MeetingNodeConfigModal` in edit mode |
| Disable Node | Toggle in inspector; PATCH `isActive` |

### Analytics

**Table**: `meeting_node_events` (id, event, nodeId, roomId, worldId, payload, createdAt)

**API**: `POST /api/troo-world/meeting-nodes/analytics`

**Events**: node_created, node_edited, node_deleted, node_clicked, enter_meeting_clicked, room_entry_success, room_entry_failure, copy_invite_clicked

**Lib**: `src/lib/troo-world/meeting-node/analytics.ts` — `trackMeetingNodeEvent()`

---

## Phase 2: Avatar Profile (Completed)

### 2.1 Schema

**File**: `src/lib/db/schema.ts`

```ts
export const avatarProfiles = mysqlTable("avatar_profiles", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull(),
  displayName: varchar("displayName", { length: 120 }),
  avatarModelUrl: varchar("avatarModelUrl", { length: 512 }),
  thumbnailUrl: varchar("thumbnailUrl", { length: 512 }),
  configJson: text("configJson"),
  version: int("version").default(1).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdx: index("avatar_profiles_user_idx").on(table.userId),
  defaultIdx: index("avatar_profiles_default_idx").on(table.userId, table.isDefault),
}));
```

### 2.2 API Routes (Implemented)

| Route | File |
|-------|------|
| `GET /api/avatars/me` | `src/app/api/avatars/me/route.ts` |
| `GET /api/avatars/default` | `src/app/api/avatars/default/route.ts` |
| `POST /api/avatars` | `src/app/api/avatars/route.ts` |
| `GET /api/avatars/[avatarId]` | `src/app/api/avatars/[avatarId]/route.ts` |
| `PATCH /api/avatars/[avatarId]` | `src/app/api/avatars/[avatarId]/route.ts` |
| `POST /api/avatars/[avatarId]/set-default` | `src/app/api/avatars/[avatarId]/set-default/route.ts` |

### 2.3 UI Components (Implemented)

| Component | Path |
|-----------|------|
| `AvatarCreator` | `src/components/avatars/AvatarCreator.tsx` |
| `AvatarManager` | `src/components/avatars/AvatarManager.tsx` |
| `AvatarPreviewCard` | `src/components/avatars/AvatarPreviewCard.tsx` |

### 2.4 Lib (Implemented)

| File | Purpose |
|------|---------|
| `src/lib/avatars/types.ts` | RoomAvatarIdentity, AvatarProfile types |
| `src/lib/avatars/avatar-presets.ts` | Preset list, FALLBACK_AVATAR_URL |
| `src/lib/avatars/resolve-room-avatar.ts` | buildRoomAvatarIdentity, getFallbackAvatarIdentity |

### 2.5 Room Integration (Implemented)

- `/meet` page fetches `GET /api/avatars/default` on mount
- If avatar exists: pre-fill displayName, use thumbnailUrl for 2D preview
- If not: show "You're using default guest avatar" banner + link to Create Avatar
- Avatar page: `/avatars` — Create Avatar, Manage Avatars, Set Default
- Dashboard Tools: "Avatar" link in Operate section

---

## Phase 3: Invites & Realtime (Completed)

### 3.1 Schema (Implemented)

**File**: `src/lib/db/schema.ts`

```ts
export const meetingInvites = mysqlTable("meeting_invites", {
  id: varchar("id", { length: 36 }).primaryKey(),
  meetingNodeId: varchar("meetingNodeId", { length: 36 }).notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  inviteeUserId: int("inviteeUserId"),
  inviteeEmail: varchar("inviteeEmail", { length: 320 }),
  inviteeWallet: varchar("inviteeWallet", { length: 42 }),
  inviteToken: varchar("inviteToken", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "revoked", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

### 3.2 API Routes (Implemented)

| Route | File |
|-------|------|
| `POST /api/troo-world/meeting-nodes/[nodeId]/invites` | Create invite (auth required) |
| `GET /api/invites/[token]` | Resolve invite, return roomId, roomName |
| `GET /api/troo-world/meeting-nodes/[nodeId]/participants` | Participant list (LiveKit `RoomServiceClient.listParticipants`) |

### 3.3 Invite Flow (Implemented)

- **Copy Invite** in interaction card: creates tokenized invite via POST, copies `/meet/invite/{token}`; falls back to direct room link if not authenticated
- **`/meet/invite/[token]`**: resolves token, redirects to `/meet?room=...&name=...`
- **Participant count**: fetched from participants API when card opens (LiveKit real-time count)

### 3.4 Realtime (Phase 4+)

- **Option**: Liveblocks, PartyKit, or custom WebSocket
- **Room ID**: `roomId = ${worldId}:${nodeId}`
- **Presence**: Participant list, mute status, avatar thumbnails — integrate with LiveKit

---

## Phase 4: Node & Building Purchase (Implemented)

- **Meeting nodes** in `world_library_assets` with `category: "meeting_node"` — seed: `npm run db:seed-meeting-node`
- **Buildings** in `world_library_assets` with `category: "building"` — seed: `npm run db:seed-buildings`
- Combined seed: `npm run db:seed-troo-assets`
- User purchases via `POST /api/world-assets/[assetId]/purchase` (TROO tokens)
- `user_world_assets` tracks ownership; user can place only owned assets
- Admin Asset Library (`/admin/world-assets`): category dropdown (props, building, meeting_node), filter by category
- World Explorer: note about purchasing in editor; OwnedAssetLibrary catalog filter (building, meeting_node, props)
- **Server-side validation**: `PUT /api/worlds/[worldId]/draft` rejects placements with unowned assetIds
- **Asset rendering**: WorldPlacementLayer renders GLB models when modelUrl is available; procedural assets (procedural:apex, procedural:harborview, procedural:corporate_meeting_node_v1) use Troo procedural builders (buildApexExterior, buildHarborviewExterior, buildMeetingNodeGizmo); unknown assets use category-colored placeholders
- **World viewer**: Fetches `/api/world-assets` to build assetMap for rendering placed assets

---

## Phase 5: World NFT Ownership (Implemented)

- **Schema**: `worlds` table extended with `ownerWallet`, `nftContractAddress`, `nftTokenId`, `saleStatus`
- **Migration**: `npm run db:migrate-worlds-nft` or `node scripts/run-migration.mjs drizzle/0025_worlds_nft_ownership.sql`
- **Edit rights**: `canEdit = (userId === ownerId) OR (connectedWallet === ownerWallet)` — pass `X-Wallet-Address` header when wallet connected
- **PATCH /api/worlds/[worldId]**: Owner can set `ownerWallet`, `nftContractAddress`, `nftTokenId`, `saleStatus`
- **World editor**: "Link wallet for NFT ownership" button when wallet connected and ownerWallet not set; passes wallet in headers for draft save and publish
- **Signature verification**: When using wallet-based auth (no userId match), draft save and publish require EIP-191 signature. Client signs `Edit world {worldId} at {timestamp}`; server verifies via viem `recoverAddress`. Message valid for 5 minutes.

---

## File-by-File Implementation Order

### Phase 1 (Meeting Node MVP)

1. **Schema**: Add `meeting_node_placements` to `schema.worlds.ts`, run migration
2. **API**: `src/app/api/troo-world/meeting-nodes/route.ts` (GET, POST)
3. **API**: `src/app/api/troo-world/meeting-nodes/[nodeId]/route.ts` (GET, PATCH, DELETE)
4. **Model**: `src/lib/troo-world/meeting-node/MeetingNodeModel.ts` (procedural gizmo)
5. **Component**: `MeetingNodeConfigModal.tsx`
6. **Component**: `MeetingNodeGizmo.tsx` (R3F or raw Three in UnifiedViewer)
7. **Component**: `MeetingNodeInteractionCard.tsx`
8. **Modify**: `WorldInspector.tsx` — add "Add Meeting Node"
9. **Modify**: `TrooWorldEditor.tsx` — fetch/save nodes, placement mode
10. **Modify**: `TrooWorldUnifiedViewer.tsx` — render nodes, handle click
11. **Route**: `src/app/meet/[roomId]/page.tsx` — room entry
12. **Asset**: Seed `corporate_meeting_node_v1` in `world_library_assets` (optional; can use procedural only for v1)

### Phase 2 (Avatar)

13. **Schema**: `avatar_profiles`
14. **API**: `/api/avatars/*`
15. **Components**: `AvatarCreator`, `AvatarManager`
16. **Integrate**: Room spawn uses avatar URL

### Phase 3 (Invites + Realtime)

17. **Schema**: `meeting_invites`
18. **API**: Invite create/resolve
19. **Realtime**: Presence, voice (Liveblocks or similar)

---

## Existing Code Reference

| Concept | Existing Location |
|---------|-------------------|
| Troo placements | `troo_world_placements`, `TrooWorldEditor`, `TrooWorldUnifiedViewer` |
| World editor | `src/app/worlds/[worldId]/edit/page.tsx` (different system — chunk-based) |
| Commerce nodes | `worldCommerceNodes`, `CommerceEditorPanel`, `CommerceNodeLayer` |
| Auth | `requireUserId`, `verifyToken` in `@/lib/auth` |
| World assets | `worldLibraryAssets`, `OwnedAssetLibrary`, `/api/world-assets` |
| Meet page | `src/app/meet/page.tsx` |
| Building enter | `WorldInspector` → `onEnterBuilding` → `/modeling?enter=nexus` |

---

## Key Integration Points

### TrooWorldEditor

- **File**: `src/components/troo-world/TrooWorldEditor.tsx`
- **State**: `placements` from API; add `meetingNodes` state
- **Fetch**: `GET /api/troo-world/meeting-nodes?worldId=...` alongside placements
- **Save**: On "Add Node" from inspector → POST meeting node

### TrooWorldUnifiedViewer

- **File**: `src/components/troo-world/TrooWorldUnifiedViewer.tsx`
- **loadPlacement()**: After loading building, fetch its meeting nodes; add child gizmos
- **Click handler**: If click hits node gizmo → show `MeetingNodeInteractionCard`
- **Card actions**: "Enter Meeting" → `router.push(/meet/${roomId})`

### WorldInspector

- **File**: `src/components/troo-world/WorldInspector.tsx`
- **InspectorPlacement**: Add "Add Meeting Node" when `placement.interiorRoute` exists (enterable building)
- **Modal**: `MeetingNodeConfigModal` — room name, capacity, access, modes
- **Callback**: `onAddMeetingNode(placementId, config)` → parent saves via API

---

## Suggested TROO Pricing (from spec)

| Asset | Price |
|-------|-------|
| Corporate Building | 5,000 TROO |
| Meeting Node | 7,500 TROO |
| Full setup | 12,500 TROO |

Store in `worldLibraryAssets.tokenPrice` or `meetingNodeAssets.tokenPrice`.

---

## Technical Rules (Enforce Server-Side)

1. Only world owner or collaborator can place/edit node
2. Meeting node can only be placed on compatible buildings (nexus, meridian, apex, harborview for v1)
3. Room cannot activate until node is valid and published
4. If user has avatar, use it; else fallback guest avatar
5. Node placement and room config stay off-chain; ownership (later) on-chain
