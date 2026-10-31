# Mobile member appearance and Gold profile

## Current scope

Mobile uses existing website member credentials. Members register at https://troothhurtz.app/, then return after administrator approval and delivery of the generated password. There is no separate mobile registration or credential store. Active/approved account checks, host-only cookies and authenticated no-store profile APIs remain authoritative. Terms collection stays off until finalization; administrators retain their separate account view.

The owner explicitly approved removing Vercel Authentication from the entire smart-trust-mobile-preview project, including its preview URLs, so members can reach the app login normally. That project setting is now disabled. This does not grant profile access: signed-out profile API requests still return 401. The hero-market website project's hosting settings are unchanged.

## Account-backed appearance

Members with no assigned image see appearance setup after permitted access; returning image owners open their profile. An unavailable avatar service is unknown, not proof of an absent avatar. Gold/Dawn/Neon and raster-image uploads use the existing authenticated profile endpoint. The owner approved and reported successful creation of mobile_member_profiles and mobile_member_appearance in hero-market; database access is Preview-only on the specifically approved feature branch. No additional schema or data migration is introduced by the visual restoration.

Native picker selections are bound to their originating member. Page hiding clears private display data; a returning selection revalidates the account. Account switching and logout invalidate pending selections. Profile loading is awaited to prevent an older read replacing a newly saved image. Only skin changes are submitted by Save Profile; existing saved images and website usernames are preserved.

## Screenshot-directed Gold restoration

The supplied profile screenshots are design references only. Their example avatar, account name/node counts, KYC claims, image-renewal dates and simulated account messages are not copied into real member data or presented as verified service behavior.

Restored styling includes the black/gold palette, subtle scanlines and stars, glowing rounded frame, gold action buttons, rounded panels, banner with overlapping member avatar, profile heading, Start Your Journey and collapsible appearance/account/workspace sections. Unsupported prototype store, entity, KYC and banner-renewal functions are not invented. The layout remains constrained to the viewport with its own scroll area and safe-area padding.

Inline Dawn/Neon/Gold buttons preview a skin. Save Profile persists it through the existing member-bound skin PATCH. The day/night switches share a small standalone display module; its only localStorage key is smart-trust-mobile-view-mode and its only accepted values are day/night. No credentials, account IDs, images, terms or ownership are stored there. An unavailable browser store does not prevent changing the current view.

Orbitron and Share Tech Mono are self-hosted under public/mobile with their original SIL Open Font License texts. No Google Fonts or other external font request is needed at runtime. Sources: google/fonts, ofl/orbitron/Orbitron[wght].ttf (blob 1fc54ce7116a6ec549f37358466bcc92f9a72c33) and ofl/sharetechmono/ShareTechMono-Regular.ttf (blob 1611474a4cc94c3cb51664597cae92a6f3c68857). The binaries are unmodified. HTTPS website avatar thumbnails are permitted with no-referrer image requests; connect-src remains same-origin.

## Validation and remaining acceptance

Optimized Next build and TypeScript pass. 51 root route/browser-model/display-preference checks and 25 package/runtime checks pass (76 total); one existing isolated-database terms integration test remains skipped. Tests cover native picker/account isolation, website-avatar reuse, skin allowlisting and Save Profile behavior, day/night synchronization and non-sensitive persistence, administrator separation, packaged asset hashes, and real built-server route/asset behavior.

Prior zero-row deployment checks verified marketplace_users, mobile_member_profiles, mobile_member_appearance, avatar_profiles and worlds without returning or changing member records. The public app login was observed in a browser without a Vercel access request or tester URL. No real member image/skin round trip, physical phone screenshot, authenticated profile visual comparison or 3D world entry is claimed. A Chromium test-runtime download failed earlier; physical iPhone/Android acceptance remains required.

Catalog publication, paid inference, real-value purchases, repository merges and production website changes remain outside this visual update. Existing local prototype images and saved member assets are not imported, replaced or deleted by the theme changes.
