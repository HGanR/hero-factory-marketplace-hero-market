# SMART TRUST Mobile: same-repository account integration

Draft integration in HGanR/hero-factory-marketplace-hero-market, based on recovery-from-prod e8e432ffcc145823934845d3fcc2e0fb15683ab7 (the source shown in the supplied Vercel screenshot). Ported from HGanR/oct12026heromarket PR #8 at 5259e1700893944698b7e579dfcfddcccaea4eca; that earlier PR is a reference, not the Vercel-connected source. No merge, deployment, database migration, entitlement change, or credential rotation performed.

## Entry and authentication

`/mobile` is a standalone mobile HTML route in the existing Next.js project. Its gold visual styles derive from Aura's corrected v0.4.15 export. That exact source is retained in `docs/mobile/aura-v0.4.15.html` (SHA-256 c50c23740dd4c190ea6467b4e42c28946b421930c34ca7423ef1587258ebf1f6). It is a design reference, not a production authentication system. No explorer source is imported.

The integrated screen provides website sign-in, a server-confirmed read-only profile, links to existing website workspaces, logout, and install support. Prototype avatar editing, device-local intake, fake email codes, KYC declarations, made-up member counts, sales and gifts, simulated updates, and simulated wallet balances are not exposed as live functionality. Remaining prototype features are preserved in the reference and need separate server-backed integration. The full proposed 17-section agreement is available at `/mobile/terms` for review only; no acceptance is recorded or legally asserted.

`/api/mobile/session` POST validates the request origin and shape, then invokes the existing marketplace login implementation. Its HttpOnly cookie is preserved. GET checks only `auth-token` (never falls back to an admin cookie), validates its signed member ID, and queries current account approval/activity. DELETE clears the member cookie with the same cookie settings as website login. Logout affects the member website session in this browser; it does not revoke other devices or clear the independent admin cookie. No passwords, password hashes, JWTs or member profiles are persisted in localStorage/sessionStorage. Account output is rendered with textContent.

This adds no new authorization for website tools. Those existing destinations retain their own permissions. Member credentials are shared with the website/desktop account source; existing desktop session licensing and entitlements are unchanged.

## Review activation on the actual Vercel-connected repository

Target repository: HGanR/hero-factory-marketplace-hero-market. Base and PR target: recovery-from-prod, matching the supplied Vercel deployment at e8e432f. This is deliberately not a replacement of main or a merge of the other repository's history.

The new branch pins Node 24.x in package.json and .nvmrc. Vercel documents that engines.node overrides project settings on a new build: https://vercel.com/docs/functions/runtimes/node-js/node-js-versions . Existing deployments and dashboard settings are not changed by this PR. The old open-ended >=20 range did not give a stable major-version contract.

Set SMART_TRUST_MOBILE_ENABLED=true only on an authorized protected Preview deployment. It defaults off. Configure DATABASE_URL for an isolated test database with the existing schema and approved non-production accounts. Configure a new preview-only JWT_SECRET shared by website login and mobile within that preview. Never reuse production database credentials or its signing secret. Keep unrelated external service credentials unset or sandboxed. Do not paste secrets into chat or commit them.

Use the existing hero-market Vercel project with this repository; do not reconnect it to oct12026heromarket. Verify Preview protection before enabling the flag. Prefer the branch-specific Preview environment. If deploying through CLI, use a clean checkout of this branch and verify its git SHA and project link first; `vercel` creates a Preview, while `vercel --prod` must not be used for this review. Do not run migrations against production. Environment changes require a new deployment.

Canonical production host: troothhurtz.app. Preview uses its generated host and same-origin relative requests. Leave AUTH_COOKIE_DOMAIN unset for host-only preview cookies unless a deliberate matching review domain is configured. Production cookies do not authenticate the isolated preview.

No merge, deployment, preview provisioning, environment changes, secret rotation or production activation were performed. Live website/mobile sharing, phone installation and the acceptance matrix below still need the authorized review environment.

Before production: verify the deployment source, full CI, login rate limits/enumeration/session revocation, legal/privacy/versioned acceptance and framework patch level. This branch retains Next 16.0.8; the earlier npm security warning remains a separate unresolved review item. Existing next.config.ts also has ignoreBuildErrors=true, so a build alone does not establish type safety. The package script typecheck:tsc points at a missing tsconfig.typecheck.json on this base; use explicit `tsc --noEmit -p tsconfig.json` for an honest check rather than claiming that script passed.

## PWA and updates

Manifest, 512px PNG and SVG icons, and a worker are scoped to `/mobile`. The worker has no fetch handler and caches no responses, credentials or private account data. Online connectivity is required. Normal page reloads get the latest network version. A waiting worker offers an explicit update/reload button. Installation is offered when the browser emits beforeinstallprompt; other browsers receive Add to Home Screen guidance. Platform-specific installation and shared-cookie behavior must be tested on iPhone Safari and Android Chrome; installation is not claimed from manifest presence alone.

## Prior PR #8 validation (historical; not full target-repository evidence)

Run `node --test tests/mobile/mobile.test.cjs` after installing the repository's dev dependencies (uses the existing TypeScript package).

14 tests pass: identity bounds/admin rejection, feature/config gating, invalid cookies, current account eligibility, unavailable database, cross-origin rejection, login-cookie delegation, malformed input, member-only logout, late browser response isolation, pagehide clearing, no device credential storage, no API caching, and gated HTML/CSP.

Tests use injected database/JWT/login fixtures and a minimal DOM. They do not establish live login, real wallet pairing, payment verification, KYC, or whole-repository build success.

GitNexus query/impact/detect-changes were attempted via CLI 1.6.12; each reported no indexed repositories. No full repository graph was available. All changes are new mobile paths and a preserved design reference; no existing symbols are edited. Manual scope review covers the website login, cookie helper, member schema, root layout/providers, and canonical-host middleware. `/mobile` uses a route handler rather than the website root React layout to avoid loading unrelated wallet/analytics providers into the mobile shell.

## Real acceptance checks (not run in Codex)

- Enable on a protected review deployment with non-production test accounts and the matching configured signing secret.
- Sign in on the website, open `/mobile`, confirm the same member profile. Repeat mobile login in a clean browser.
- Wrong password, inactive/unapproved/deleted account, expired cookie, offline/503: no account view or stale identity.
- Sign out, switch accounts, navigate back, and open a second tab: revalidation must show the current member, never prior member data.
- Confirm existing website and desktop login/entitlement behavior is unchanged.
- Test install, reopen, update and logout on iPhone and Android; no private API responses in browser caches.
- Verify workspace links and actual destination permissions against the deployed site.

## Aura review assignment

Review this draft against the corrected v0.4.15 source. Identify remaining screens requiring real APIs; preserve the original visual direction. Report visual/device checks separately from mocked tests. Do not claim prototype KYC, balances, agent metrics or email codes are live. No merge/deploy/spend or production access changes.

Additional validation: isolated Next.js 16.0.8 harness build and TypeScript checks passed with stubbed existing backend dependencies; this is not a full website build. Chromium at 390px passed login/profile/logout, password clearing, empty browser storage, terms navigation and no JavaScript errors with a mocked account API. Visual inspection completed. Worker script is served at `/smart-trust-mobile-sw.js` so its allowed scope includes the `/mobile` entry route.

## Aura review response (2026-10-25)

- D1: not reproduced. The PNG is served by `src/app/mobile/icon.png/route.ts`, already present at 333f15fd. A binary-response regression check now binds the manifest and Apple icon URL to the route's 200 image/png response, PNG signature and 512x512 IHDR. It is not a missing public file.
- D2: footer changed from a release-like number to `MOBILE · REVIEW BUILD`; no parity with the prototype version is claimed.
- D3–D5 remain production review items: explicit signing-secret configuration, existing login throttling/enumeration, and browser-local logout without cross-device revocation. No secret rotation or existing authentication changes are part of this revision. The mobile error body is generic, but inherited 404/401 status differences remain observable; do not claim enumeration is fully prevented.
- Deployment must verify canonical apex redirects and cookie settings. A domain-wide AUTH_COOKIE_DOMAIN is not inherently necessary for an apex-only flow; verify the intended host behavior rather than widening cookie scope automatically.
- Aura reports prototype v0.4.18. That source has not been supplied or verified here; future adoption must obtain and hash it first. The preserved v0.4.15 reference is unchanged.
- Theme scoping/cleanup, full CI, real accounts, phone installation, legal acceptance/versioning and framework security review remain outstanding. No deployment approval is implied.

Review follow-up validation: 15/15 Node tests passed; Pillow fully decoded the embedded PNG as 512x512 RGB. This turn did not repeat the isolated Next build or device checks.

## Correct-repository validation (2026-10-26)

Runtime: Node v24.22.1. Dependencies installed locally with lifecycle scripts disabled, no production credentials.

- `npm run test:mobile`: 15/15 passed.
- `node --import tsx --test src/lib/auth.session-cookies.test.ts`: 3/3 passed against this repository's existing cookie tests.
- Initial `npm ci --ignore-scripts`: refused because the existing lockfile lacked declared dependencies. `npm install --ignore-scripts --no-audit --no-fund` reconciled 71 added package records, root metadata, fflate 0.8.2 to the declared 0.8.3, and fsevents metadata. Declared dependency ranges and Next 16.0.8 unchanged.
- Reconciled `npm ci --ignore-scripts --dry-run --no-audit --no-fund`: passed. This is lock consistency evidence, not proof of lifecycle scripts or deployment success.
- Full `tsc --noEmit -p tsconfig.json`: exceeded the default ~2GB Node heap; not passed.
- `NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.mobile-review.json`: two errors in unchanged DB dependencies, zero diagnostics in new mobile sources: src/lib/db/index.ts:31 TS2769 (string/options overload), src/lib/db/schema.ts:13 TS2308 (duplicate agentConversationSessions exports). A separate DB-only include reproduced both without the mobile code. This scoped check remains failing; it is not a type-check pass.
- No actual account login, phone installation, database migration, credential configuration, or Vercel deployment performed. Historical isolated browser/harness results above are not substituted for the full target build.

The two database definitions exporting agentConversationSessions are not silently reconciled here: choosing between schemas can affect existing consumers. Existing auth, middleware, database and Next build configuration bytes are unchanged.

Full `npm run build` was attempted with no DATABASE_URL or JWT_SECRET. It was terminated with exit 137 (`Killed`) during webpack compilation in this environment; no successful full build is claimed. The log did not identify a source-code compile error before termination. Review deployment remains blocked on a successful full build and the documented checks.
