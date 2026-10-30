# Member health reports and targeted updates — implementation candidate

Status: unmerged implementation, not a deployed service or a distributable installer. No production configuration, migration, release, catalog publication, key rotation or paid service was activated.

## Connected repositories

- `HGanR/smart_trust_os`: feature branch based on `fix/windows-member-recovery-20261026` at `b22ba9d54b7cf1fa57598a2217b42ea3ce1b5e2a`. This retains the existing Windows recovery work; no main reset.
- `HGanR/hero-factory-marketplace-hero-market`: based on mobile preview branch at `e26b3dd932fec6b627a5a675725047e381343957`. Website member login is reused, not replaced.
- `HGanR/web3sitetrust`: release backend based on main at `46c4192a7ccc3bf506f68160e8e21721a6825529`.
- `HGanR/skipper`: based on REN repair branch at `7bbdf85ac3b9b12c2b1c2cfc67e05a9ca8bdf868`.

The feature branch is `feat/member-health-pipeline-20261030` in each repository. These changes do not implement mobile deployment, wallet purchasing or new REN reconstruction behavior.

## Member experience

A replacement installer includes a health-report consent checkbox in Update Center. Reporting is off until the member opts in. After a successful authenticated identity handshake, a bounded local queue captures error categories and an advisory unexpected-shutdown signal; it retries offline deliveries. It sends app version, platform/architecture, time and category only. Raw exception text, stacks, URLs, conversations, documents, wallet material, tokens and passwords are excluded. Unknown local fields are stripped before delivery and rejected by the server.

The queue is scoped to website origin and member identity, holds at most 20 reports and expires reports after 30 days. Repeated categories are deduplicated for one minute. Repeated deliveries retain their report ID. The member-ID precondition prevents account switching during delivery from attributing account A's queued report to account B. Consent withdrawal clears only this feature's local diagnostic queues, not app projects or previously received platform incidents.

A heartbeat marker can identify an unclean prior session after a successful future sign-in. This is not a native crash dump or proof of out-of-memory failure; power loss, forced termination and some reloads can cause the same signal. Failures before the initial identity handshake cannot be safely assigned to a member. Native fatal-crash capture, real OS lifecycle behavior and memory-soak testing remain outstanding.

## Platform and release backend

The website's new `/api/desktop-health/session`, `/report` and `/decision` routes authenticate the existing HttpOnly member cookie with an explicitly configured JWT secret and re-read active/approved status from `marketplace_users`. Browser writes require same-origin checks; native health requests set Origin through the existing Rust authenticated transport. Health requests use HTTPS without redirects. No token is exposed to frontend JavaScript.

The website proxies to the existing release backend using a short-lived HMAC-signed server envelope. Account identity and operator/member role come from authenticated server state, never report fields. Members can only submit reports or request their own release decision. Operators can import, inspect compatible approved releases, approve a specific target or revoke it. The shared bridge secret is server-only; it must not be placed in a desktop build or VITE variable. Backend nonces reject replay and are account-rate-limited. Intake additionally permits at most 30 new incidents per account/day, with atomic report deduplication and conflicting-content rejection.

PostgreSQL stores incidents, fingerprints and explicit account/installation targets. Raw installation bindings are hashed for incident/target storage. The signed release decision still uses the native binding for verification. Import cursors preserve PostgreSQL timestamp precision and let SKIPPER resume through a backlog. Server retention is intentionally not implemented as an automatic destructive job; agree the retention policy before production activation.

Apply `src/release-service/persistence/migrations/002_desktop_health.sql` to an isolated test database first. The existing applied 001 migration is unchanged. New tables are not automatically migrated at startup. When health is enabled, startup checks that its tables exist and requires durable storage rather than using an in-memory production fallback.

## SKIPPER investigation and owner controls

With the existing Website Skipper admin connection active, the Connections panel imports reports immediately and every five minutes while open, up to ten pages per import. The local SQLite incident store is scoped to that connected admin account. It persists immutable evidence, assignment state and a resume cursor together. The panel displays the latest 100 local incidents; older imported incidents remain stored.

`Assign investigation to Coding Agent` uses the selected registered project/worktree and the established direct-child delegated-run path. It retains that path's approval stream and workspace checks. Reports cannot contain instructions or grant execution/release authority. A confirmed run ID is stored; repeated assignments and uncertain dispatch retries are blocked. This is a governed investigation assignment, not unattended deployment.

`Choose an approved fix` lists compatible release candidates. The owner can confirm an offer to the incident's installation for 24 hours. The advanced target API also supports an explicit whole-account target and revocation. Target approval pins the normalized manifest digest and requires a catalog release already approved/rolling out with `approved-member` in its eligible plans. The targeting action does not approve or publish an unapproved catalog release. Native clients continue checking by pull; nothing is force-installed.

## Targeted package verification

New candidate builds opt into an authenticated member-decision route. The original non-member decision path remains unchanged when that compile-time option is absent. Targeted offers are signed by the existing backend decision signer. Native optional manifest fields are explicitly normalized to null before hashing/signing for Rust serde compatibility.

The backend exposes an approved-release-only Tauri feed at `/v1/releases/smart-trust-os/tauri/:releaseId`. Native preparation selects that exact release feed, checks package version/URL/signature against the signed manifest, verifies the download through Tauri, checks checksum and size, and stages it in the application cache. Before installing, the client refreshes account/target authorization and rejects expiry, revocation, account changes or changed manifest contents. It re-checks staged bytes and retains the existing backup, write-gate and install-authorization requirements. Artifact requests receive no member cookies. Installation still requires the member's confirmation.

Package preparation uses the plugin's in-memory download and limits the advertised package size to 256 MiB. Native memory, cancellation, filesystem and installer behavior require real platform testing. No claim of a successful native installation is made here.

## Configuration and activation sequence

1. Review the four draft PRs. Use isolated test accounts, secrets, storage and existing hosting resources; do not change production or add paid infrastructure.
2. On the release backend, apply migration 002 in the test database and configure existing decision signing plus `SMART_TRUST_HEALTH_ENABLED=true` and a high-entropy `SMART_TRUST_HEALTH_BRIDGE_SECRET` (at least 32 characters).
3. On the website server, configure `SMART_TRUST_HEALTH_ENABLED=true`, the same server-only bridge secret, `SMART_TRUST_HEALTH_SERVICE_URL=https://<release-host>/internal/desktop-health`, and its existing JWT/database settings. Do not point a preview at production member data without explicit approval. The isolated mobile-preview package does not automatically expose these new website routes; its packaging must be deliberately extended if that is the chosen integration test host.
4. For the new native candidate, configure compile-time `SMART_TRUST_MEMBER_UPDATE_ORIGIN` to the existing website sign-in origin, `SMART_TRUST_UPDATE_SERVICE_BASE_URL` to the release backend base, exact manifest/artifact host lists, and the existing decision public-key configuration. Provide the artifact public key as `SMART_TRUST_UPDATER_PUBLIC_KEY`; artifact signing private material belongs only in the trusted build environment.
5. The release workflow conditionally validates these settings, enables updater artifacts and uploads signatures when the member-update origin is configured. It does not publish a CDN manifest, change release status or dispatch itself. Preserve the existing application identifier and data locations. Do not generate/rotate production keys casually; no real keys were generated in this implementation.
6. Test a bootstrap installer on Windows and Mac, including an existing member data directory, opt-in, offline reporting, account switching, protected admin import, investigation assignment, approved targeted version A-to-B update, revoked target and preserved saved data.
7. Obtain owner approval before production merges/deployment, member distribution, target activation or any new spending. Members receive one replacement download; they are not asked to run terminal commands or configure diagnostics.

## Validation and remaining evidence

- Release backend: full strict TypeScript check passes. 33 tests pass; two PostgreSQL integration checks skip without database configuration. New tests exercise real HTTP handling, HMAC/replay rules, account/device isolation, real Ed25519 signatures, manifest changes, revocation and redacted report schemas. The health store is in-memory in those HTTP fixtures; real PostgreSQL verification is separately opt-in using `TEST_HEALTH_DATABASE_URL`.
- Website: focused strict TypeScript check of all new health modules/routes against their real imported dependencies passes; three authentication, bounded-body and bridge-signing tests pass. No whole-website build is claimed.
- Desktop: focused strict TypeScript check of new health modules and the modified render boundary passes; four queue/privacy/recovery tests and two candidate-configuration tests pass. Modified shell/settings modules are syntax-checked. Rust changes are source/syntax inspected only, not compiled or run here: this environment lacks the native Rust/Tauri toolchain.
- SKIPPER: six tests pass using actual temporary SQLite storage and Flask routes; bridge/UI Python/JavaScript syntax checks pass. Existing delegated execution is reused, not executed against a real member incident here.

No live member health reports were collected, no production database was touched, no native installer was built or distributed, and no targeted release was activated. Real test-host deployment, PostgreSQL execution and native Windows/Mac acceptance are necessary before claiming end-to-end delivery.
