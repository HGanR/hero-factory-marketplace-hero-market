# Jarvon: administrator avatar, stadium seating and proximity voice

Status: agreed behavior recorded; implementation is incomplete. The coding workspace became unavailable during prototype generation. No avatar/presence changes have been published. The existing stadium renovation remains live.

## Agreed experience

- Jarvon is reserved for Charles's administrator account. Assignment must be bound to a verified server-side account identity, rather than an avatar URL, a client-supplied role, or the fact that someone opened the editor.
- Activate the avatar in first-person walking and event hosting. Working interpretation to confirm in review: the administrator sees his body/hands while looking down; other participants see the complete avatar. Do not hide the host from attendees merely because the host camera is first person.
- Start with walking and standing at the circular center stage microphone. Animation shortcut keys and accessory libraries are later work.
- After successful admission, attendees receive distinct seats facing the center speaker. Paid events require the existing exact NFT contract/token-ID proof before credentials or a seat are issued. Preserve the existing free-event policy unless the owner explicitly changes it.
- The host microphone reaches the event audience. Other visitors' ordinary conversations are proximity based: nearby speech is audible and fades as distance increases.
- Microphones start muted. Joining or logging in never silently captures a microphone or camera. Provide deliberate microphone enable/mute, audio unlock when required by the browser, leave/disconnect, and individual local mute.
- Preserve all existing Green Terrain placement, rotation, resizing, media, billboard, ticker and event controls.

## Implementation boundaries

1. Produce and inspect a rigged 3D Jarvon prototype with standing and walking animations. The generated portrait/full-body concept is not an uploadable avatar. A procedural prototype must be identified as such; final portrait likeness and shader polish need art review.
2. Add a server-owned avatar assignment. Jarvon must be claimable only by the owner administrator and must not be impersonated through participant metadata or data packets. A public GLB asset is not itself an authorization mechanism.
3. Assign seats atomically on the server, with uniqueness under concurrent admission, stable reconnect behavior, bounded leases and safe stale-session removal before reusing a seat.
4. Use authoritative fixed attendee/host poses in the event room. Attendees are seated facing the microphone; the host stands at the stage. Do not trust an attendee's packet to claim a stage position or a host role.
5. Use room-scoped, server-issued metadata for role/avatar identity; disallow participant self-updates of those fields. Validate and bound walking pose packets separately.
6. Separate host broadcast gain from attendee proximity gain. Nearby voice must use selective subscriptions and/or attenuation, start silent until location/room validation, and avoid duplicate host audio. Client attenuation is an experience feature, not a guarantee of private conversations against modified clients.
7. Release tracks, audio elements, room listeners, animation resources and presence state on exit/logout/disconnect. Test account changes, permission denial and browser audio restrictions.
8. Keep preview rooms, assignments and seat state isolated from production.

## Confirmed prerequisites and limitations

Vercel environment-variable metadata was checked on 2026-11-14: LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are not configured for this project. No values were decrypted or printed. No voice service was purchased or provisioned.

The current stadium implementation connects through LiveKit for events, but audience credentials are subscribe-only and there is no world proximity/presence service or automatic seat assignment yet. Current host joining also automatically requests microphone/camera access; this needs replacement with deliberate controls.

Durable avatar ownership and concurrent seat assignment require an approved storage design and migrations if new tables are used. Do not run live schema changes as part of the blocked prototype session. Existing event challenge-table migration and real NFT holder/non-holder acceptance remain prerequisites for live paid events.

## Required acceptance before release

- Real GLB inspection: correct full-body silhouette, brown skin, blue/cyan/violet holographic materials, valid rig, standing/walking animations, no missing textures, desktop/mobile performance and first-person clipping.
- Canonical administrator JWT/account verification; member and forged-role rejection; Jarvon ownership isolation.
- Real database tests for simultaneous seat allocations, retries/rejoins, full rooms, expired leases and preview isolation.
- Real NFT holder/non-holder tests for the configured contract and token ID 0.
- Two separate authenticated browsers/devices: walking avatar synchronization; a seated attendee; host broadcast; distance-based visitor audio; mute/unmute; permission denial; audio unlock; leaving and cleanup.
- Verify server-enforced room boundaries and role/track grants. Do not claim that JWT expiration alone disconnects an already-connected participant.
- Preserve the existing event/media/editor and mobile/desktop navigation regression suite.
- Owner preview review before production release.

Reference documentation consulted: LiveKit tokens/grants, https://docs.livekit.io/frontends/reference/tokens-grants/ ; selective subscriptions, https://docs.livekit.io/transport/media/subscribe/ .
