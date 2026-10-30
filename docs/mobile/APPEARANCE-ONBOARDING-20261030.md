# Mobile appearance onboarding

Stacked on member profile PR #11 at 2f654e0cf3ee265c63b21c5564b7446ce6bf520d. Login and terms checks remain authoritative. This change does not activate terms collection or deploy anything.

After permitted member access, load the account profile before choosing a screen. Missing image with an available avatar service opens appearance setup; assigned image opens profile. An unavailable avatar service is an error/unknown state, not proof that no avatar exists. Administrators retain their separate view. Setup offers Gold, Dawn and Neon, plus the existing account-backed raster-image uploader. Existing image owners can reopen appearance settings. Finish requires a saved image and a successful server skin save. Logout/project generation checks prevent late responses from repopulating account content.

Website marketplace_users.username is NOT NULL and UNIQUE. The existing verified website username is displayed and preserved; this PR does not implement renaming credentials or create a second identity. A corrupt/missing username remains a session validation error requiring account repair, not an invented mobile account.

Apply drizzle/manual/mobile_member_appearance_20261030.sql to the explicitly approved schema before deployment; it adds a separate table only. The existing SMART_TRUST_MOBILE_VERIFY_PROFILE_DB readiness option now also checks this table without reading member rows. Runtime credentials need SELECT/INSERT/UPDATE for this table. No migration, grants, environment edits or production writes were executed here.

Validation executed on Node 24.22.1: 8 new appearance flow/service tests with modeled DOM and mocked database + 4 existing profile helper tests pass. Browser client and readiness script syntax checks pass. Profile helper standalone TypeScript check passes using local Node types (the first attempt lacked Node types; rerun used the installed types). These are not real browser, real database, full application build or phone validation. Full branch build and protected preview testing remain required before activation. The tests live in tests/mobile/appearance.test.mjs and apps/mobile-preview/tests/profile.test.mjs; the latter expects prepare:source first.

Before activation test the real flow: login, terms (when activated), new image upload, skin save, logout and reopen on a second device; returning existing avatar; avatar service outage; failed save; logout while save runs; administrator exemption. Verify each skin visually at phone widths. Live mobile.troothhurtz.app alias is untouched.
