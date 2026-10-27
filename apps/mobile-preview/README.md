# SMART TRUST Mobile — protected Preview target

This is a test build target in the existing website repository, not a separate account system or replacement website. It packages the canonical mobile code and real auth/database dependencies from `../../src` at build time. Source copies are hash-recorded and ignored by Git. Edit the canonical sources, not `shared/`.

## Build and test

From this directory on Node 24:

```sh
npm ci
npm run build
npm test
```

Tests require the built `.next` output. They start real local Next servers, with no database credentials, to test gating, assets, JWT rejection/validation, same-origin checks and unavailable-database handling. The root `tests/mobile` suite additionally exercises account rules with injected fixtures. Neither suite proves real member login.

## Vercel setup

Use a dedicated **protected test project** connected to this same repository and feature branch. Do not change the live hero-market project's Root Directory or domains.

- Root Directory: `apps/mobile-preview`
- Include source files outside the Root Directory: enabled (the builder reads canonical website sources)
- Framework: Next.js; Node 24; Install: `npm ci`; Build: `npm run build`; Output: default
- Target: **Preview**, not production. The config refuses `VERCEL_ENV=production`.
- Deployment Protection: enabled before member-account testing.
- Preview environment: `SMART_TRUST_MOBILE_ENABLED=true`, `DATABASE_URL`, `JWT_SECRET`. Enter secrets directly in Vercel. Do not put them in Git or chat.
- Start with an isolated test database and the same schema/password-hash format as the website. Confirm any switch to the real member database explicitly; successful login updates `lastLogin`.
- Leave `AUTH_COOKIE_DOMAIN` unset on the separate preview host. The preview and website have separate browser sessions. Workspace links redirect to `https://troothhurtz.app`.

No external website assets, AI engines, admin routes or the unguarded marketplace login route are exposed here. The mobile API internally delegates to the original website login function, whose source is copied unchanged. Feature/secret checks execute before that call. Application source parity does not imply identical library versions: this target independently pins patched Next.js, React, Drizzle and mysql2 versions; the root website dependency files are untouched.

A deployment URL, correct Preview environment and real account/device checks are still required before declaring Phase 1 complete. See `../../docs/mobile/DELIVERY-PHASES.md` and `../../docs/mobile/MOBILE-PREVIEW-VALIDATION.md`.
