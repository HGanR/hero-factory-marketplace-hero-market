# Delivery phases — 2026-10-27

## Phase 1: mobile test deployment (active priority)

Goal: approved, active website members use the same username/email and password in SMART TRUST Mobile, then test on phones. Keep source in this website repository.

The full website is still blocked by unrelated source/type/build issues. `apps/mobile-preview` provides a separately buildable **protected Preview target**, without removing unfinished website routes or changing the live website's build settings. It packages the actual mobile routes and their transitive source dependencies, including the existing marketplace login, password validation, account approval checks, database tables and cookie helpers. A SHA-256 manifest records the copied source; generated copies are never hand-edited or committed.

This target is not a production replacement for the website. It refuses builds when VERCEL_ENV=production. Use a separate test project in the same repository, with Root Directory `apps/mobile-preview` and access to files outside that directory. Keep the existing hero-market project's settings and domain unchanged. No project or deployment has been created by adding these files.

The test app has sign-in, server-confirmed profile, logout, install assets, review-only terms and links to website workspaces. It is not the complete prototype. Workspace links open the canonical website, where its own session applies. Preview cookies do not automatically carry across to troothhurtz.app.

### Configuration and acceptance

- Node 24; `npm ci`; `npm run build`; Next.js framework; default `.next` output. Enable Vercel Deployment Protection before using account data.
- Feature flag SMART_TRUST_MOBILE_ENABLED=true on the Preview only. Configure DATABASE_URL and a strong JWT_SECRET through Vercel, never in source or chat. AUTH_COOKIE_DOMAIN should be unset for a separate preview hostname.
- Begin with non-production test accounts in an isolated database using the website schema and password hashes. Existing-account parity means preserving the actual password hashes, active and approved flags; do not reset passwords or create a second membership system.
- Testing all existing members against the live member database is a distinct operational step: confirm the database target before connecting it. Website login updates lastLogin, so this is not read-only access.
- Verify correct and wrong passwords; unapproved, inactive, deleted and expired accounts; unavailable database; logout and account switch; second-tab revalidation; no cached private responses.
- Test iPhone Safari and Android Chrome installation, reopen, session expiry, update and logout. Record exact deployment commit and device/browser results.
- A built app is not evidence of a successful real account login. Do not call Phase 1 complete until a protected URL and the live checks exist.

The isolated target pins a current Next.js release separately; the root website's existing framework pin is unchanged. The website's pre-existing hardcoded JWT fallback, direct-login enumeration, missing rate limiting and lack of cross-device revocation still need production security work. Mobile requires JWT_SECRET before calling login. This preview does not expose the direct marketplace login endpoint or any admin routes.

## Phase 2: SMART TRUST Desktop stability

Keep Windows recovery work separate from mobile and Catalina. Reproduce intake → Scenario Lab with an actual Windows build; capture the failing request and UI error. Run an idle/active soak with renderer/process memory, logs, event listeners, timers, network polling, 3D resource allocation/disposal and crash events recorded. Distinguish a renderer crash from expired login, navigation failure and backend outage. Ship measured fixes and retest session recovery and member isolation. Prior code tests do not establish that the member's crash is fixed.

## Phase 3: Skipper → REN → TAYO quality

Verify one retained reference and project revision across upload, saved REN brief, build action, Blender job, validated GLB, viewport and reloadable draft. Test cancel/retry and errors. Evaluate reference versus output from front, side and detail views: silhouette, floors, balconies, stairs, entrances, material colors, UVs and textures. State inferred/hidden geometry honestly. Neural reconstruction remains a benchmark-driven choice; dependency installation and mesh extraction tests alone do not establish image fidelity. Preserve manual paint edits and separate catalog approval. Texture resolution is not an artistic-quality score.

## Aura review assignment

Review the isolated mobile source packaging, authentication parity and absence of unintended API exposure; verify lockfile/build evidence and deployment settings. Keep Phase 2 and 3 evidence separate. Do not mark device tests or real logins complete based on unit fixtures.
