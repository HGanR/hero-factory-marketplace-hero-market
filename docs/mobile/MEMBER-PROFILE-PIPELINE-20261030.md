# Member profile and Journey pipeline

The website, SMART TRUST Desktop, and mobile serve members. SKIPPER Desktop and the Coding Agent are administrator tools; mobile does not connect a phone to the administrator's loopback agent.

## Findings

The deployed mobile authentication shell returns the approved member's ID, username, email and saved wallet address. It did not contain a banner, selected avatar, or Journey button. The preserved aura prototype stores bannerData and avatarData under the device-wide `tt_test_v1` localStorage key. These are not server account records and cannot be trusted as belonging to whichever account signs in next. No automatic import, deletion, or reassignment of those images is performed.

The website already selects its default 3D avatar through `avatar_profiles` (`userId`, `isDefault`, `status`, `thumbnailUrl`). There is no profile banner in `marketplace_users`. Website avatar routes use the website session cookie and are not exposed by the isolated mobile package.

## Implemented behavior

1. Existing mobile sign-in establishes the host-only member session; session GET rechecks active/approved membership. The existing terms gate is preserved, including its current unpublished/off state and administrator exemption.
2. The profile appears with its top banner, avatar/initial fallback and START YOUR JOURNEY button. A separate authenticated, no-store `/api/mobile/profile` reads only that member's images and worlds. It uses the same server session check, including the terms gate when enabled; administrator identity never becomes a member ID.
3. A saved mobile profile image takes precedence over the website default-avatar thumbnail. Removing that image falls back to the existing default avatar. It does not modify any 3D model or avatar selection. Missing thumbnail/service and broken images have clear fallback behavior.
4. PNG, JPEG and WebP selections are decoded and resized on-device to bounded PNGs. The API independently checks image format headers, dimensions, size, same origin, authenticated membership and allowed fields. SVG/HTML, arbitrary account IDs and remote upload URLs are refused. One image is updated per request; changing a banner preserves the avatar. Save succeeds only after database write and readback.
5. Journey opens a mobile explorer listing actual nonarchived `worlds` records owned by that member. Empty and unavailable states are separate. No starter property, stadium, NFT balance, token access, ownership or 3D entry is invented. Full 3D entry and desktop synchronization remain unconnected.
6. Logout, page hiding and session changes clear images and world details. Delayed responses cannot restore a prior account's profile. No member imagery is put in localStorage or a service-worker cache.

## Activation and remaining verification

This is a draft feature branch stacked on the terms draft, with no production merge, live-domain change or database mutation performed by the agent. Apply `drizzle/manual/mobile_member_profiles_20261030.sql` to the owner-approved account schema (`hero-market`) before testing account-backed saves. It creates one additive table; it never modifies existing account or avatar tables. The readiness script can validate the profile and existing avatar/world columns with zero member rows using `SMART_TRUST_MOBILE_VERIFY_PROFILE_DB=true`.

Protected preview deployment, member sign-in, image save/reload from a second browser or phone, account switching, and iPhone/Android visual testing must still be verified against real services. Existing prototype-only images remain on their original device and require intentional selection/upload for the intended member account. No real-value payments are enabled.
