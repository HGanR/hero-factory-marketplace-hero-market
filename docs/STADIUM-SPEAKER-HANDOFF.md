# Stage access and speaking turns

The previous navigation rule excluded every visitor, including the administrator, from the inner 18-unit stage area. Scheduled-event identities were also frozen at their initial position. Verified administrators can now descend the stairs, walk through the guest area, use the physical ramp, and walk behind the microphone. Other visitors retain the stage boundary. All movement uses the saved stadium transform and scale.

For a scheduled event, join as the administrator host. Click an attendee's portrait in the 3D view, or its matching image in the accessible attendee list, then **Invite to speak**. Their HUD offers **Yes, I would like to speak** and **No, stay seated**. An invitation alone does not move or unmute anyone. Accepting places the attendee behind the microphone, asks to enable their microphone, and seats/mutes the host. Only the active stage speaker broadcasts to the event; seated participants retain proximity conversation controls.

The host selects the speaker's portrait and chooses **End speaking turn**. The guest is returned to their original reserved seat and muted; the host returns behind the microphone. The host can enable their microphone again. Declines and expired/canceled invitations keep people in place. A speaker or host disconnect restores the remaining clients to a safe state through server reconciliation.

Host authority stays with the verified administrator. Attendee acceptance requires that participant's current opaque seat-session capability plus the exact outstanding invitation. Only one invitation/turn can be active per room. Database compare-and-swap rejects overlapping changes; turn IDs prevent an old End request from stopping a later turn. Position, stage role and invitation metadata are updated by the server. Clients cannot grant themselves stage access or event broadcast by changing their own metadata.

## Prerequisites and testing

This is preview work. The existing LiveKit configuration and `sql/troo-avatar-presence.sql` are still prerequisites. The additional `sql/stadium-speaker-floor.sql` creates the per-event speaking-turn record; no migration is applied at app startup. Apply schema changes only to an approved environment. Production and preview use separate room and database scopes. The existing Green Terrain placement, media, ticker, event and admission controls remain intact.

Test with a free scheduled event first: one admin and two attendees, each in a separate browser/profile. Verify physical ramp walking, selection in the scene, decline, acceptance, stage broadcast, host seating, End, original-seat restoration, and disconnection recovery. Paid-event NFT admission remains unchanged and still needs real holder/nonholder acceptance before paid launch. This does not add or promise server-side scheduled event-end eviction or a proven audience capacity.
