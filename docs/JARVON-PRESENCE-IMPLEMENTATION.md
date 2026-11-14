# Jarvon and stadium presence

This branch is a preview implementation. It does not change the production world layout, existing Green Terrain media controls, or saved stadium placement.

## What is implemented

- Original 1.18 MB rigged procedural Jarvon GLB, 17 bones, Idle/Walk/Seated clips. This is a stylized working prototype; the supplied portrait's likeness and high-detail holographic art are not yet achieved.
- Canonical signed administrator session can claim Jarvon once per environment. Another admin cannot take that assignment. Browser-supplied avatar/host fields are ignored.
- First-person owner body with hidden head; remote users see the full assigned avatar. No accessory library or animation shortcuts yet.
- Unique database-backed public stadium seats, transformed with the saved stadium position/rotation/scale and facing the center. Reconnect retains the seat; expired leases are disconnected at the media server before reuse. Public attendees cannot walk off their event seat. The administrator host is placed at the stage microphone.
- Deliberate microphone activation, muted on entry. No camera capture. Nearest audible speakers are selectively subscribed; volume fades between 2 and 12 world units. The event host has priority and reaches all listeners in that event room. Individual mute, audio-enable and disconnect controls are available.
- Protected presence and event credentials contain server-issued role/avatar metadata with `canUpdateOwnMetadata: false` and microphone-only publish grants. Event attendees cannot publish movement data; room admission retains the existing Polygon NFT proof.

The nearby audio distance is a client listening rule, not a privacy boundary against a modified client. Event admission is enforced separately at token issuance. Maximum world-room occupancy is currently 100; the subscription cap is 12 audible speakers, with host priority. The 614 modeled public seats are not a proven concurrent-user capacity. Production capacity needs a load test and the chosen media service plan.

## Deployment prerequisites — do not execute as an automatic app startup

1. Review and explicitly approve the additive `sql/troo-avatar-presence.sql` migration for the intended database. Existing paid admission also needs `sql/stadium-event-challenges.sql`.
2. Configure an approved LiveKit server using `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`. No new service is provisioned by this branch. Do not copy the CI dev credentials into a deployment.
3. Use the admin's canonical login and select **Assign Jarvon to my account**. Anonymous users and ordinary members cannot claim it.
4. Accept the portrait/art quality in `/avatar-preview`, then test two actual users/devices: first-person movement, remote avatar, proximity microphone, stage broadcast, seated event admission, wallet changes and disconnect/rejoin.
5. Run actual Polygon holder/nonholder acceptance for contract `0x7202cd71cb52ce0d71b9a13f2dacc4599b6cb13a`, token ID `0`, before treating paid-event launch as accepted.

The event-end timer and seat renewal disconnect the standard client. A server-side event-end revocation job is still required to force custom clients out exactly at event end; JWT expiration alone does not terminate a connected LiveKit participant. This branch does not claim that enforcement.

Preview ownership and seat rows use branch-specific scopes. Preview room names are also isolated from production. The profile endpoint reports missing storage/server setup; it does not create tables or expose secrets.

## Verification

Core tests parse the actual GLB with Three.js, exercise the skeleton and clips, verify every inward-facing transformed seat, and reject invalid/replayed poses. Admission tests use real EIP-191 signatures and LiveKit JWT encoding with deterministic RPC ports. MySQL tests run only against disposable loopback `town_layout_test`, including competing seat assignments and exclusive admin claims. Browser acceptance runs two Chromium sessions against an isolated loopback LiveKit container and tests actual received audio RTP, near/far subscription changes, metadata immutability and muted event entry. These fixtures do not connect to production services.
