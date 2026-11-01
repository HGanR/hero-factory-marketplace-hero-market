# Mobile Preview target validation — 2026-10-27

Base: c2a5b069f49f58bdf4e5664e5bdb8567553dec34. This pass adds the isolated build target and delivery roadmap; it does not repair the entire website.

## Actual execution

Node 24.22.1. Commands run from the repository root:

```
npm ci --prefix apps/mobile-preview --no-fund
npm run build --prefix apps/mobile-preview
npm test --prefix apps/mobile-preview
NODE_PATH="$PWD/apps/mobile-preview/node_modules" node --test tests/mobile/*.test.cjs
npm audit --prefix apps/mobile-preview --omit=dev --json
```

- Clean dependency install: passed with the committed target lockfile.
- Full target Next.js 16.4.3 webpack build: passed, including strict TypeScript and build traces. No stub backend dependencies, no ignoreBuildErrors. No DATABASE_URL/JWT_SECRET supplied for build; runtime account checks remain necessary.
- Source packager: 28 canonical files/assets, verified byte-for-byte by SHA-256. It follows imports/exports and refuses missing local imports or undeclared packages. Existing source functions are unchanged.
- Target tests: 6/6 passed. Three start the real built Next server: default-disabled 404; enabled HTML/assets and missing-secret 503; JWT verification, missing database 503, unauthenticated 401, cross-origin refusal and invalid credential shape. Three verify source equality, route exposure and production-build refusal.
- Existing mobile/connection CJS tests: 17/17 passed, with injected fixtures. These cover active/approved accounts and denial cases but do not contact a real member database. The TypeScript schema-export regression also passed (18 mobile checks total), and all 3 existing auth cookie tests passed using the isolated target dependencies and the existing tsx loader.
- Runtime dependency audit: zero reported vulnerabilities after target-only updates to Drizzle 0.45.4 and mysql2 3.24.6. Initial inherited 0.45.0/3.15.3 produced advisories and were replaced. Next 16.4.3 and React/React DOM 19.3.1 are independently pinned in this target. This is not an audit of the root website dependencies or a guarantee against undiscovered vulnerabilities.

Initial HTTP testing used 127.0.0.1, while Next constructed localhost request URLs; the existing exact-origin guard correctly rejected the mismatched origin. Repeating with the server's canonical localhost origin passes. The deployed Preview hostname/origin and reverse-proxy behavior still require live checks; the origin guard was not loosened to pass a test.

## Not yet verified

- Vercel remote build, protected URL, environment configuration and account database target.
- Real member username/password login, approved/inactive/deleted account matrix, successful database queries and cookie persistence.
- iPhone/Android install, browser rendering, offline/reopen/update and real device session behavior.
- Entire website build and its previous diagnostics; Windows crash reproduction; REN/TAYO artistic output.

Vercel CLI 65.4.0 `whoami --format json --non-interactive` reported loggedIn=false and linkedProject=null in this environment. Installing plugin guidance did not authenticate that CLI. No deployment, promotion, domain change or database migration was performed in this validation pass.

Next.js security reference used for the isolated target: https://nextjs.org/blog/nextjs-security-update-october-14-2026 (patched active line begins at 16.4.1). Root website Next.js 16.0.8 remains a separate upgrade task.

GitNexus staged detection: 18 files, 33 symbols, low risk, zero indexed affected processes. This is not proof of zero callers: indexing reported 7,945 omitted entrypoint candidates, 37,794 skipped callees and 28 budget-cut walks. No canonical website function was edited; the new target composes existing source.

Before the final Preview-only help-link adjustment, GitNexus impact on its GET wrapper reported UNKNOWN with no resolved callers (six unresolved GET receiver sites). Next route dispatch is the direct consumer, verified from the route location and built route manifest; runtime tests cover the wrapper and website link.
