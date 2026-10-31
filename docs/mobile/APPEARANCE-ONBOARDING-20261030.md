# Mobile appearance onboarding

Stacked on member profile PR #11 at 2f654e0cf3ee265c63b21c5564b7446ce6bf520d. Login and terms checks remain authoritative. This change does not activate terms collection or deploy anything.

After permitted member access, load the account profile before choosing a screen. Missing image with an available avatar service opens appearance setup; assigned image opens profile. An unavailable avatar service is an error/unknown state, not proof that no avatar exists. Administrators retain their separate view. Setup offers Gold, Dawn and Neon, plus the existing account-backed raster-image uploader. Existing image owners can reopen appearance settings. Finish requires a saved image and a successful server skin save. Logout/project generation checks prevent late responses from repopulating account content.

Website marketplace_users.username is NOT NULL and UNIQUE. The existing verified website username is displayed and preserved; this PR does not implement renaming credentials or create a second identity. A corrupt/missing username remains a session validation error requiring account repair, not an invented mobile account.

Apply drizzle/manual/mobile_member_appearance_20261030.sql to the explicitly approved schema before deployment; it adds a separate table only. The existing SMART_TRUST_MOBILE_VERIFY_PROFILE_DB readiness option now also checks this table without reading member rows. Runtime credentials need SELECT/INSERT/UPDATE for this table. No migration, grants, environment edits or production writes were executed here.

Validation executed on Node 24.22.1: 8 new appearance flow/service tests with modeled DOM and mocked database + 4 existing profile helper tests pass. Browser client and readiness script syntax checks pass. Profile helper standalone TypeScript check passes using local Node types (the first attempt lacked Node types; rerun used the installed types). These are not real browser, real database, full application build or phone validation. Full branch build and protected preview testing remain required before activation. The tests live in tests/mobile/appearance.test.mjs and apps/mobile-preview/tests/profile.test.mjs; the latter expects prepare:source first.

Before activation test the real flow: login, terms (when activated), new image upload, skin save, logout and reopen on a second device; returning existing avatar; avatar service outage; failed save; logout while save runs; administrator exemption. Verify each skin visually at phone widths. Live mobile.troothhurtz.app alias is untouched.


## Full review and repair follow-up

The initial full regression run failed nine browser-harness checks because the existing harness did not provide document.body.dataset. The harness now models that browser property, and appearance checks are included in the Vercel build command instead of running only the older mobile tests. This fixes the test integration without weakening assertions.

Dawn/Neon custom properties previously inherited from body but were overridden by .device's historical theme declarations. Palettes now target .device directly, including text, input, glass, link, focus and button colors. Real browser and physical-phone visual confirmation remain pending. A Chromium test-runtime installation attempt returned truncated/non-ZIP downloads; no browser screenshots or overflow verification are claimed.

Native image-picker page hiding can clear the private profile before the file-change event. Selections now capture their originating member, refresh the session/profile when necessary, and refuse uploads after an account switch or logout. Profile loading is awaited before finishing session refresh, preventing an older read from overwriting newly saved image state. Native buttons open hidden file inputs for keyboard as well as pointer access. New regressions cover selected website avatars, picker resume, account switching, cancelled selections and allowlisted skin PATCH ownership.

Activation remains separate: the live mobile address stays on the working PR #11 deployment. This branch needs the additional mobile_member_appearance table plus expressly approved Preview-only account database binding for feat/mobile-appearance-onboarding-20261030 before member testing. Existing approvals and database access for the profile branch are preserved. No production table, environment access, terms switch or live alias is changed by this repair.

Website avatar thumbnails also needed the mobile HTML image policy repaired: the previous img-src self/data policy blocked the HTTPS thumbnails the profile API deliberately returns. HTTPS image loading is now permitted for that use, with no-referrer on the profile images. connect-src remains same-origin; wallet/RPC access is not enabled.

Final local validation after repairs: optimized Next build and TypeScript pass; 46 root route/browser-model checks and 25 package/runtime checks pass (71 passed total). One existing isolated-database terms test is skipped because no test database is configured. No real-member image/skin round trip, native phone-picker test, browser screenshot or viewport measurement is claimed. The new picker tests simulate session clearing and account changes; actual iPhone/Android validation remains required.

## Direct member access and website registration

The owner clarified that mobile members must reach the app's own sign-in page without Vercel registration, access requests or tester links. Registration remains at https://troothhurtz.app/; after administrator approval and delivery of the website-generated password, the member returns to mobile and uses the same username/email and password. The page now states this flow and uses an explicit website link. The extra hosting/test banner outside the app layout is removed. No new mobile registration endpoint or alternate credential store is introduced.

Application authentication, active/approved account checks, host-only cookies and member-only profile APIs remain unchanged. Opening the HTML sign-in page must not grant profile or image access.

Hosting change is separately pending: automatic approval review rejected setting ssoProtection=null on smart-trust-mobile-preview because it disables Vercel Authentication for that entire project, including its deployment preview URLs. No protection setting was changed by that rejected operation. The available connector did not establish a domain-only exception for this staging alias. Explicit owner approval for the full project setting is required before retrying; the live hero-market website project is outside this change.
