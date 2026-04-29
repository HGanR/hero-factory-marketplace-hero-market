# Venue GLB + Interior Node Spec

## Current Flow (Implemented)

1. **Admin** adds assets at `/admin/world-assets` (categories: `building`, `venue`, `meeting_node`, `props`)
2. **Upload**: GLB + preview image via `/api/admin/world-assets/upload` → stored in `public/models/world-assets/`
3. **User** purchases from Browse Assets (World Explorer nav) → `user_world_assets` row per user (no conflicts when multiple users buy same asset)
4. **User** places in world via World Editor → `world_chunk_placements` (placements on terrain)
5. **Commerce nodes** are created in the editor (Commerce tab) and placed on terrain

## Desired Flow: Venue GLB with Interior Node

### Requirements

- **Venue GLB**: Concert hall, seminar room, etc. with interior space
- **Interior node**: Placed inside the GLB, enables:
  - Live shows
  - Chatrooms with voice
  - Other users interact globally
- **Upload**: GLB + dependencies (textures, etc.) so it works when users buy it
- **No conflicts**: Multiple users buying the same asset → each gets their own instance; each placement gets a unique room/session ID

### Implementation Notes

1. **Asset category**: `venue` added — GLBs that support interior nodes use category `venue` or `building`
2. **GLB dependencies**: 
   - Prefer **embedded GLB** (textures baked in) for simplicity
   - If external deps needed: extend upload to accept zip or multiple files; store in asset-specific folder
3. **Interior node placement**: 
   - **Implemented**: `venue_interior_nodes` table (see `docs/VENUE_INTERIOR_NODE_IMPLEMENTATION_PLAN.md`)
   - APIs: `GET/POST /api/worlds/[worldId]/venue-nodes`, `GET/PATCH/DELETE /api/worlds/[worldId]/venue-nodes/[nodeId]`
   - Entry: `GET /api/worlds/venue-nodes/entry?roomId=...`
4. **Room ID**: `{worldId}:{placementId}:{nodeId}` — implemented in `buildVenueRoomId()`
5. **Avatar**: User's default avatar (from `/avatars`) is used in meeting rooms; ensure world viewer/meeting integration fetches avatar

### File References

| Area | Path |
|------|------|
| Admin assets | `src/app/admin/world-assets/page.tsx` |
| Upload API | `src/app/api/admin/world-assets/upload/route.ts` |
| Asset schema | `src/lib/db/schema.worlds.ts` → `worldLibraryAssets`, `userWorldAssets` |
| Meeting nodes (Troo) | `src/app/api/troo-world/meeting-nodes/route.ts` |
| Avatar resolution | `src/lib/avatars/resolve-room-avatar.ts` |
