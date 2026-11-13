# Airport integration — preservation gate

The approved airport is the standalone `airport_cycle_30min.glb` (SHA-256 `83ba5e7bb48658831e67f5259f570331465ff5a8bb22bbc1275817e9a8ad43aa`), **not** the older GLB inside `AIRPORT(1).zip` with green grass.

## Invariants
- Never regenerate or replace the existing airport mesh with the older ZIP variant.
- Never insert a scene placement automatically.
- Never update any world version, chunk placement, world transform, scale, rotation, or user ownership when publishing the catalog record.
- Never overwrite an existing `world_library_assets` entry.
- Do not publish a catalog record until the exact approved GLB is present at `public/models/world-assets/airport_cycle_30min.glb`.
- Do not guess a token price: `AIRPORT_TOKEN_PRICE` must be explicitly set.
- The catalog reads published, active, non-platform-only database entries. The model file alone does not populate it.

## Verification before release
1. Check the committed GLB checksum and direct HTTP response for its public model URL.
2. Confirm the intended price and run the publisher only after explicit database-change approval.
3. Check `GET /api/world-assets?category=airport` returns the airport model URL.
4. Verify existing Green Terrain world placements and transform values remain byte-for-byte unchanged.
5. Confirm adding the catalog record does not create an airport in any scene.
6. Complete the secure paid checkout before enabling purchases of nonzero-priced assets.

No migration, model replacement, database publication, or production deployment is performed by adding this documentation.
