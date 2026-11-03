# Engine access repairs following Muse PR #22

## Evidence and branch

Muse's documentation-only PR #22 at `c8e29c32f874fc795cd9959071ee1e8f593f8077` was verified draft/unmerged, based on audited gateway PR #21 at `0db3b8c58e3d7414603f4439e1a3ca1e1e2adbcf`. This repair is a separate draft stacked on PR #22; it does not alter the audit/specification documents or audited source PR heads.

The two route findings are confirmed by source reads: legacy `/api/certificates` GET and POST use a caller-supplied wallet without authentication; admin Troo World placement GET/PUT accept any verified userId and do not enforce a world owner. The latter operates on platform `trooWorlds`, not the separate multi-tenant `worlds.ownerId` model. Existing world administration routes already require administrators. Public rendering uses `/api/troo-world/placements` separately.

Further evidence: `POST /api/marketplace/wallet` lets the authenticated user change their walletAddress without a signature. `POST /api/v1/identity/wallets` creates links with verifiedAt NULL. Neither is adequate proof for access to wallet-indexed legacy certificates. This repair does not claim to implement wallet verification or change either linking endpoint.

## Changes

- Both certificate methods authenticate using the existing HS256 session verifier, which fails closed when the production secret is missing. Numeric positive marketplace user identity is required; administrator session precedence is preserved. No auth-system migration or new provider.
- Administrators retain legacy certificate read/write access. Members need a pre-existing EVM `troo_wallet_links` row joined to their own `troo_identities.userId`, matching the requested normalized wallet and having non-null verifiedAt. A profile wallet, other member's verified link, or unverified link is refused. No verification timestamp is created here. Non-EVM member certificate access is not introduced.
- Cookie-authenticated certificate POST and admin placement PUT require same-origin requests. Certificate responses are private/no-store; driver errors are redacted.
- Certificate request-time CREATE/ALTER operations are removed. The existing dashboard_certificates table/columns must already be provisioned by a separately approved schema process. Missing tables fail with a generic unavailable response; this draft applies no migration.
- Platform placement GET/PUT require an administrator before database access or default-world seeding. Ordinary members cannot overwrite default or green-terrain using this admin route. The public viewer endpoint and separate member-owned world APIs are unchanged.

## Intentional compatibility changes and remaining work

Unauthenticated wallet-indexed certificate reads/saves stop working. Members whose identity link is unverified or absent receive 403, even if their mutable profile wallet matches. This is intentional authorization enforcement, not completed wallet onboarding. Existing verified-link/provisioning availability on production is not established; no SQL is run here to set verifiedAt or create the identity tables. Authorized administrators retain the legacy rendering/save payload contract.

Ordinary members can no longer use the platform admin endpoint to save the shared green-terrain world. Public viewing remains through its existing endpoint; owned-world editing must use the separate ownership-checked APIs, not this platform bucket. Client-side editor visibility was not redesigned by this repair.

GLB URL allowlisting, numeric placement payload validation, placement transaction/meeting cleanup semantics and the public viewer's legacy auto-seeding remain separate findings/work. This draft does not claim to have resolved all asset ingestion risks. Certificate image format/size validation is also unchanged. Broader wallet-link proof/nonce verification is separate Phase 2 work.

## Tests and limits

Local `node --check tests/engine-access/routes.test.mjs` passed. CI runs `node --test tests/engine-access/routes.test.mjs`: actual modified route handlers, shared access helper and existing jose verifier with real HS256-signed fixture sessions. Only SQL/Drizzle persistence is doubled. Cases cover anonymous and forged JWT refusal, verified/unverified/foreign wallet access, administrator compatibility, cross-origin denial, shared-world non-admin denial, admin saves, missing production secret and redacted driver errors. No real database, browser, wallet signature or provider is exercised. CI also runs the ten gateway cases, 22 approval-boundary cases and 42 STEP 2 cases. Record actual execution results in the PR; syntax checking alone is not a passing suite.

No paid provider, live send, database mutation, wallet signing, merge, manual deployment, cron registration or revenue-loop enablement occurred. These patches do not protect a deployed site until separately reviewed and deployed. Native Mac and membership collection remain open.

## Production adapter work after this repair

Muse's 8/8 source audit is accepted as code-reading evidence, separate from live execution. Preserve the explicit distinction between intake and actual website generation. Close Stephon's remaining AI/intelligence/version/action/provider inventory before implementing a duplicate brief-to-schema engine. Its current IPFS deployment publishes publicly and cannot serve as a private preview by renaming it. QR needs a declared encoder, decode tests of actual saved bytes and a client/trust ownership mapping before registration. No production adapter is registered by this repair.


## Follow-up: editor page gate

Aura correctly identified that the original six files did not change the page gate. At the initial repair SHA, `src/app/green-terrain/page.tsx` still wrapped the editor in sign-in-only AuthGate. A new server layout now checks the same fail-closed session verifier before returning editor content: anonymous/forged sessions redirect to `/admin`, ordinary members receive not-found, and valid platform administrators enter. Missing production JWT configuration throws rather than revealing editor content. The client AuthGate remains as a sign-in convenience; it no longer constitutes the page authorization boundary. The placement API retains its independent administrator checks. `/troo-town` and the public viewer API are unchanged.

This is platform-administrator authorization, consistent with the repaired API and existing admin login. It does not hardcode Charles's numeric identity or create a separate per-person allowlist. If additional platform administrators exist, they have the same administrative access. Four additional tests execute the actual server layout and real signed-session verifier with only the request-cookie/navigation context doubled. Updated CI counts are recorded in the PR after execution.
