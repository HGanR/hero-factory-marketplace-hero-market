# Mobile Preview head verification — 2026-10-29 (Aura, read-only inspection)

Head inspected: `e26b3dd932fec6b627a5a675725047e381343957`
Branch: `feat/smart-trust-mobile-preview-20261026`
Base: `recovery-from-prod` @ `e8e432ffcc145823934845d3fcc2e0fb15683ab7`
PR: #1 (draft, open, unmerged). This branch layers verification notes on top of
that work. It changes no code and no behavior. PR #1 itself was not modified.

## What was verified by inspection at the head commit

Target layout (`apps/mobile-preview/`): `README.md`, `package.json`,
`package-lock.json`, `tsconfig.json`, `next.config.mjs`, `vercel.json`,
`.gitignore`, `app/route.ts`, `app/mobile/route.ts`,
`app/mobile/icon.png/route.ts`, `app/mobile/terms/route.ts`,
`app/api/mobile/session/route.ts`, `scripts/prepare-source.mjs`,
`tests/source.test.mjs`, `tests/runtime.test.mjs`.

- Source packaging: `scripts/prepare-source.mjs` copies only the dependency
  closure of four entries (`src/app/mobile/route.ts`,
  `src/app/mobile/terms/route.ts`, `src/app/mobile/icon.png/route.ts`,
  `src/app/api/mobile/session/route.ts`) plus `public/mobile/*` and the
  service-worker file, records a SHA-256 manifest, and refuses unresolved
  local imports or undeclared packages. Copies live under gitignored
  `shared/`; canonical sources are not edited by the target.
- Sign-in parity: `src/app/api/mobile/session/route.ts` delegates POST to the
  canonical website login function unchanged, verifies JWT with HS256 pinned,
  requires active + approved accounts (Drizzle `eq` on the numeric id),
  fails closed with 503 when `JWT_SECRET` is unset (it explicitly does not
  inherit the legacy auth module's development fallback), enforces
  same-origin + 8 KB request bounds, preserves the HttpOnly cookie contract,
  and returns `no-store`. No replacement account system, no auth-policy
  change in the target.
- Route exposure: the target serves only the gated mobile API surface. The
  source test asserts the exact route list; the marketplace login route
  returns 404 in the target while remaining an internal dependency.
- Production guard: `next.config.mjs` throws when `VERCEL_ENV=production`.
  `vercel.json` sets framework/install/build only; Root Directory and
  Deployment Protection are dashboard settings, documented in the README.
- Workspace links: `/app/dashboard`, `/troo-town`, and `/wallet-dashboard`
  redirect to `https://troothhurtz.app`. The mobile page carries a
  "Protected test build" notice stating the preview session is separate.
- `.gitignore` covers `node_modules/`, `.next/`, `shared/`, `public/`,
  `source-manifest.json`, `next-env.d.ts`, `*.tsbuildinfo`, `.vercel/`,
  `.env*`. Generated copies cannot be committed by accident.
- Target pins (independent of the root website): Next 16.4.3, React 19.3.1,
  Drizzle 0.45.4, mysql2 3.24.6, TypeScript 5.9.3, Node 24.x. Root
  dependency files are untouched by the target.

## Evidence-carry gap (stated plainly)

The recorded validation (`docs/mobile/MOBILE-PREVIEW-VALIDATION.md`) ran
against the working tree on top of base `c2a5b069`. The target — code and
docs — was first committed in `e26b3dd` itself: at `c2a5b069` neither
`apps/mobile-preview/` nor the validation doc exists. The committed head
bytes therefore have no recorded build/test run against the exact commit.
Nothing in this branch re-runs them: this environment has no checkout and
cannot run `npm ci`, `next build`, or the test suites. The commands below
must be run on a checkout (or CI) and their results recorded before the
head is called verified. Do not treat this note as a passing test run.

## Re-validation commands (run on a checkout, Node 24)

```sh
git fetch origin feat/smart-trust-mobile-preview-20261026
git rev-parse HEAD  # must read e26b3dd932fec6b627a5a675725047e381343957 on the PR branch
npm ci --prefix apps/mobile-preview --no-fund
npm run build --prefix apps/mobile-preview
npm test --prefix apps/mobile-preview
NODE_PATH="$PWD/apps/mobile-preview/node_modules" node --test tests/mobile/*.test.cjs
npm audit --prefix apps/mobile-preview --omit=dev --json
```

Stop on any failure and report the failing command with its output. A
passing target build does not repair or hide the whole-website build,
which remains blocked (1,216 TypeScript diagnostics at the earlier
runner-repair baseline; recovery inventories preserved in
`docs/mobile/RUNNER-REPAIR.md`, `RUNNER-REPAIR-RESULTS.json`,
`RECOVERY-INVENTORY.json`).

## Remaining blockers for a protected test deployment (environmental)

1. Vercel: dedicated protected test project in this same repository; Root
   Directory `apps/mobile-preview`; include-source-outside-Root enabled;
   Deployment Protection on before any account data; existing live
   hero-market project settings and domain unchanged. Not provisioned from
   here; the Vercel CLI reported `loggedIn=false` in the validation
   environment and no deployment was performed.
2. Preview environment (entered in Vercel, never in source or chat):
   `SMART_TRUST_MOBILE_ENABLED=true`, isolated-test `DATABASE_URL`,
   preview-only `JWT_SECRET`. `AUTH_COOKIE_DOMAIN` unset on the separate
   preview host.
3. Database target: start with isolated test accounts/schema/password
   hashes. Confirm explicitly before any switch to the real member
   database; website login updates `lastLogin`, so this is not read-only.
4. Live checks (per `docs/mobile/DELIVERY-PHASES.md`): Vercel remote
   build, protected URL, real member login matrix (correct/wrong password;
   unapproved, inactive, deleted, expired; unavailable DB; logout/switch;
   second-tab revalidation; no cached private responses), iPhone/Android
   install/reopen/session/update/logout. None verified.
5. Production gates, unchanged and out of scope for Preview readiness:
   hardcoded JWT fallback (D3), login enumeration/rate limiting (D4),
   cross-device session revocation (D5), legal/privacy + versioned
   acceptance, root Next.js 16.0.8 framework review. Root PNG type
   declaration question (whole-website build only) also remains open.
6. Windows PR #7 and SKIPPER/REN/TAYO work stay separate.

## Validation status from this environment

- Tests run here: none. Builds run here: none. NOT RUN (no checkout).
- Tests/builds as recorded in `MOBILE-PREVIEW-VALIDATION.md` (working
  tree on `c2a5b069`, Node 24.22.1): clean `npm ci`; full target webpack
  build incl. strict TypeScript; 6/6 target tests; 18 mobile checks;
  3/3 cookie checks; zero reported runtime audit vulnerabilities.
  Those results are reported, not re-executed, and they predate the
  commit that contains the target.
