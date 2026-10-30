# Protected mobile preview — deployment checklist (DRAFT, not executed)

Prepared 2026-10-29 by Aura from the committed target (`apps/mobile-preview`),
its README, and `docs/mobile/DELIVERY-PHASES.md`. Nothing in this checklist
has been created, configured, or deployed yet. No secret values appear here:
environment-variable names only. This checklist deploys a Preview only. It
does not merge, promote to production, change the live website, or enable
payments.

## 1. What is being deployed

- Repository: `HGanR/hero-factory-marketplace-hero-market`
- Branch: `feat/smart-trust-mobile-preview-20261026` (draft PR #1, unmerged)
- Verified revision: `e26b3dd932fec6b627a5a675725047e381343957`
  (re-validation PASS executed on Charles's Mac 2026-10-29: target build,
  6/6 target tests, 17 mobile tests passed, 0 target audit vulnerabilities)
- Target: `apps/mobile-preview` only — gated `/mobile` sign-in, read-only
  server-checked profile, logout, workspace links, PWA install assets,
  review-only terms. No purchase, email, or admin surface is exposed.
- If the branch advances past `e26b3dd`, confirm the deployed commit is a
  reviewed SHA before testing any account. Record the deployed commit.

## 2. New Vercel project (separate — do not reuse the live project)

Create a NEW project in the same Vercel account/team, connected to the same
repository. Suggested name: `smart-trust-mobile-preview` (a suggestion only;
any distinct name that cannot be confused with the live project works).

- Git repository: `HGanR/hero-factory-marketplace-hero-market`
- Root Directory: `apps/mobile-preview`
- Include source files outside the Root Directory: ENABLED (the builder
  reads canonical website sources from `src/` at build time)
- Framework: Next.js; Node version: 24.x
- Install Command: `npm ci`; Build Command: `npm run build`; Output: default
- Deploy the feature branch as a Preview deployment. Do NOT run a
  production deployment. Do NOT promote any deployment to production.
  Backstop: `apps/mobile-preview/next.config.mjs` throws when
  `VERCEL_ENV=production`, so a production build fails rather than serving.
- Assign NO custom or production domain. Use the auto-generated preview
  URL only. Never add `troothhurtz.app` to this project.

## 3. Preserve the live hero-market project (verify before and after)

Do NOT open the existing `hero-market` Vercel project to edit it. In
particular, do NOT change its Root Directory, domains, environment
variables, Git settings, or framework settings; do NOT reconnect it to
another repository; do NOT redeploy it from this work.

- [ ] Before: note the live project's Root Directory and domains.
- [ ] After the preview project exists: re-open the live project's settings
      and confirm Root Directory and domains are unchanged.

## 4. Deployment Protection (before any account testing)

- [ ] Deployment Protection: ENABLED (Vercel Authentication) on the new
      project, before the preview URL is used with any account.
- [ ] Verify: opening the preview URL without Vercel authentication shows
      the Vercel auth challenge, not the app.

## 5. Environment variables (Preview environment only — names only)

Set these in the new project's Preview environment only. Never as
Production variables. Never copy production values. Never put values in
Git, chat, or this document.

| Variable | Value to enter |
| --- | --- |
| `SMART_TRUST_MOBILE_ENABLED` | `true` |
| `DATABASE_URL` | Connection string for the isolated test database (Section 6) |
| `JWT_SECRET` | Fresh preview-only secret. Generate one, e.g. `openssl rand -hex 32`, or via a password manager. Must differ from any production value. The preview's website-login copy and session verification both use this value inside this deployment; do not rely on any fallback. |
| `AUTH_COOKIE_DOMAIN` | LEAVE UNSET. Do not add it. If it exists on the project, remove it. Unset keeps cookies host-only, so preview and website sessions stay separate. |

No other variables are required by the target. No TROO/wallet, email, or
third-party keys: the target exposes no purchase, email, or admin surface.
`VERCEL_ENV` and `NODE_ENV` are set by Vercel itself.

## 6. Isolated test database

- [ ] Provision a SEPARATE MySQL database for preview testing. It must not
      be the production member database.
- [ ] Load the website schema and password-hash format. Preserve actual
      password hashes and the active/approved flags. Do not reset
      passwords. Do not create a second membership system.
- [ ] Create NON-PRODUCTION test accounts only, covering: active+approved
      (can sign in), unapproved, inactive, deleted/expired (must be
      refused). Use clearly fake names, usernames, and emails.
- [ ] Confirm `DATABASE_URL` points at the test database BEFORE the first
      login. Website login updates `lastLogin`, so this is not read-only.
- [ ] Switching to the real member database later is a separate,
      explicitly confirmed operational step. It is NOT part of this
      checklist and must not happen silently.

## 7. Deployment steps (in order)

- [ ] 1. Create the new project with the Section 2 settings.
- [ ] 2. Set the Section 5 Preview environment variables.
- [ ] 3. Enable Deployment Protection (Section 4) and verify the challenge.
- [ ] 4. Trigger a Preview deployment of the feature branch.
- [ ] 5. Confirm the deployment record's commit SHA is `e26b3dd…` (or the
      reviewed SHA recorded in Section 1).
- [ ] 6. Confirm the build log shows `prepare:source` packaging the
      sources and a successful Next.js build.
- [ ] 7. After Vercel authentication, open `/mobile` and confirm the app
      serves (flag on). Record the preview URL.

## 8. Acceptance checks (Phase 1 is not complete until these exist)

Account checks (test accounts only, isolated database):

- [ ] Correct password signs in; server-checked profile shows (read-only).
- [ ] Wrong password refused, without revealing whether the account exists
      beyond what the preview already discloses.
- [ ] Unapproved, inactive, deleted, and expired accounts refused.
- [ ] Logout works; account switch works; second-tab revalidation works.
- [ ] Private responses are not cached (check `no-store` on session/profile
      responses in browser devtools).
- [ ] Workspace links redirect to `https://troothhurtz.app`; preview
      cookies do not carry over to the website (separate sessions).
- [ ] Terms page is review-only; no acceptance is recorded.

Phone checks (record device, browser, deployment commit, and result):

- [ ] iPhone Safari: Add to Home Screen / install, reopen, session
      persists, session expiry behaves, update arrives, logout works.
- [ ] Android Chrome: install, reopen, session persists, session expiry
      behaves, update arrives, logout works.

## 9. Limits — what this preview does not do

- The payment safeguard (draft PR #4) is TESTED, not live. Until it is
  deployed, it does not protect the deployed purchase endpoint. TROO
  purchases remain disabled pending verified payment handling. This
  preview exposes no purchase surface and must not be used to test buying.
- Production security gates remain open and out of scope here: the
  hardcoded JWT fallback (D3), login enumeration / rate limiting (D4),
  and cross-device session revocation (D5), plus legal/privacy review
  and the framework review.
- The whole-website build remains blocked by unrelated source/type
  issues. That does not block this target and must not be conflated
  with it.
- The 135 root-dependency vulnerabilities are separate triage. Do NOT run
  a blanket `npm audit fix --force`. The isolated target's clean audit
  does not clear the website's dependency tree.
- Preview sessions are separate from `troothhurtz.app`. No member data
  migrates. The test app's local saves do not carry over.

## 10. Disable / rollback

- To disable the preview without deleting the project: set
  `SMART_TRUST_MOBILE_ENABLED` to `false` (or remove it) and redeploy
  the Preview. `/mobile` then returns 404.
- To remove the preview entirely: delete (or suspend) the new Vercel
  project. Deployment Protection stays on until deletion. Neither action
  touches the live `hero-market` project, its domain, or its database.

## 11. Sign-off record (fill in on execution)

| Item | Record |
| --- | --- |
| Deployed commit SHA | |
| Preview URL | |
| Deployment Protection verified | |
| Env scope verified (Preview only, no production values) | |
| Database target confirmed (isolated test DB) | |
| Account matrix results | |
| iPhone results (device/browser/commit) | |
| Android results (device/browser/commit) | |
| Tester / date | |
