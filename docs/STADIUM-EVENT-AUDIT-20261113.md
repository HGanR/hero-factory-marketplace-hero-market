# Stadium events and sidewalk audit

Source baseline: `d0c598ae38e8bfa502181ff2c1e06cfcc094a6c5`, the deployed airport/selection repair. This change preserves that lineage and existing placement snapshots. No production layout was edited during development.

## Existing venue

The 227,236-byte stadium GLB contains 499 nodes, **424 audience spawn markers**, host/cohost/backstage markers, a stage, three seating tiers, entrance tunnels, lighting/truss geometry, and named cameras. It contains no embedded animation clips. Markers are not connected attendees, working cameras or concert streams.

The old host-event form allows 12–500 participants and creates a legacy `default`-world meeting. That number was configuration, not a load-tested venue capacity. Its entry route does not enforce NFT ownership. The generic LiveKit token route previously accepted arbitrary room names. `TokenGateWrapper` is not an ownership check.

The screen effect expected `SCREEN_*`; the actual asset uses `Screen_Main`, `Screen_Side_Left`, `Screen_Side_Right` and `Scoreboard_Screen`. The shared town did not supply an event title. The exterior ticker was a fixed string.

## Implemented changes

- Green Terrain's Events tab stores title, enable/free/paid switches, admission-open/start/end times, capacity, Polygon contract and decimal token ID, and uploaded raster graphic in the same revision-checked town snapshot as placements. Token ID **0** remains valid. The supplied contract is the default; no token purchase or transfer occurs.
- Event admission windows cannot overlap. Enter Stadium reads the published policy each time. Only paid admission requires a wallet; ordinary entry outside those windows remains free. A free event can be joined without a wallet.
- The existing wagmi connectors provide installed-wallet and WalletConnect selection. A signed request binds the wallet, origin, event policy, nonce and expiry. The server atomically consumes the nonce and checks ERC-721 `ownerOf(tokenId)` or ERC-1155 `balanceOf(wallet,tokenId)` on Polygon. Unsupported contracts, RPC failures, wrong signatures, expired requests and non-holders fail closed.
- Dedicated media rooms use a reserved namespace blocked by the generic token endpoint. Server-issued audience grants are subscribe-only; an authenticated administrator can publish as host. Room-service capacity includes hosts. A repeated wallet has one participant identity. No admission token is stored in a URL or public layout.
- Stadium screens receive the scheduled graphic/title; the exterior and interior ticker receive the saved text. Original materials are restored and owned textures disposed on changes. Seat/back instances use the 424 actual audience markers; exterior columns and speaker stacks add venue detail without relocating the saved model.
- Sidewalks gain safe curb-end and obstacle detours. NPCs follow a connected route across successive slabs. Routes never bridge through a road, building, pond or parking footprint. Junction search is bounded. Completely obstructed placements may still produce separate components: moving the obstruction is necessary, rather than inventing an unsafe path. Existing custom sidewalk objects remain as placed and are not automatically repositioned.

## Release prerequisites and limits

1. Apply `sql/stadium-event-challenges.sql` explicitly before enabling paid events. Public requests never create database tables. Missing storage denies admission.
2. Configure a working Polygon RPC and LiveKit server/API credentials. The actual supplied contract's standard and live holdings still require a successful on-chain check; mocked tests are not proof of that deployment configuration.
3. Test a real holder/non-holder and a host/attendee session in the approved preview before production. The 500-person ceiling is not a throughput guarantee; no 500-client load test has been performed.
4. Ownership is checked at admission. A short-lived JWT does **not** continuously revoke a participant who transfers the NFT after joining: LiveKit maintains connected sessions. Continuous revocation, server-enforced event-end eviction and cancellation eviction need a running server reconciliation job. The client disconnects at event end and on wallet changes, but client code is not an adversarial enforcement boundary.
5. The public stadium GLB, event graphic and ticker are public promotional assets. A camera check cannot make downloaded geometry private. Protected access applies to the event's media credentials. This is a new event room path; old `/meet` links do not become NFT-gated retroactively.
6. Changes to an active policy create a distinct protected room; connected users in the prior room are not automatically migrated or evicted. Avoid changing gate/times/capacity during an active paid event until reconciliation is implemented.

## Verification

Automated tests cover paid/pre-entry/free time boundaries, token ID zero, invalid gates, full public snapshot persistence, real EIP-191 signatures, non-holder rejection, RPC/wrong-chain failure, concurrent nonce replay, reserved-room bypass rejection and safe multi-segment sidewalk walking. LiveKit room provisioning and RPC responses are deterministic ports in admission unit tests; the JWT and wallet signatures are real. SQL concurrency runs against disposable MySQL in CI. Browser and full build results are recorded in the pull request as they complete.
