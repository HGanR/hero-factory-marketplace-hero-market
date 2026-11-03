# Stephon private draft adapter — executable draft

## Baseline and scope

Stacked on access-repair PR #23 (`eb6aaecce46f5f6ded5f462de3616c94b759a673`). The two corrected Muse documents are copied byte-for-byte from PR #22 at `508dce9f31c08282aee00e5ea94be70255af94fa`; no whole-branch merge or rewrite of Muse's audit/QR specification. Existing audited PR heads remain unchanged.

Adds `stephon.generate_draft` (fourth approval adapter; catalog total 14 = 10 reads + 4 approval actions). An explicit approved job targets an EXISTING owned, client-linked DRAFT site, a bounded brief and a generation mode. This first version does not create sites, assign clients, change currentVersionId, publish, upload to IPFS, register cron or generate QR codes. Site setup must exist; missing/multiple choices remain a business clarification, not a fabricated UUID.

`stephon.projects` now actually lists up to 50 owned site records (optionally an owned client). Previously the gateway called the tool with no client, which always returned an empty list. Discovery includes a bounded owned-site context; its failure does not prevent catalog discovery. Paired Coding Agent must preserve that context instead of replacing it when adding client records; companion delivery is tracked separately.

## Shared generation and provider boundary

The existing Pages API `full` implementation is extracted to `src/lib/site-builder/ai/full-generation.ts` and called by both the original endpoint and the new executor. Planner, schema generator, content intelligence/critique, evaluation, metadata and original endpoint behavior are reused. Other endpoint steps remain unchanged. The original pipeline timeout error class is shared so endpoint timeout responses retain their status/stage handling.

Adapter ownership checks precede provider settings access or generation. Mode `deterministic` forces the existing off/deterministic selector, so no model invocation occurs even if global credentials exist. Mode `configured` explicitly permits the existing per-site/global provider path and its existing fallback behavior; no provider is added. It reads the existing AI settings table without the legacy runtime CREATE TABLE helper. Missing settings tables fail closed. Exact provider pricing is not established; receipt cost is explicitly unmeasured, never a dollar quote. No configured provider is invoked during implementation/tests.

The adapter calls the shared pipeline with generation-intelligence persistence/retrieval skipped: those legacy paths provision tables at runtime and are inappropriate inside the audited execution transaction. The receipt reports intelligenceStatus=skipped. The adapter's version/artifact/client receipt is its durable record; no intelligenceRunId is invented. The original endpoint retains its existing intelligence behavior.

Every generated draft is `qualityStatus: review_required`. Planner source, model/use/fallback, generic-content and critique/evaluation metadata survive in the receipt. A deterministic result is not presented as LLM output or professional delivery. No browser/visual acceptance has been performed yet.

## Persistence and private preview design decision

No schema migration or new external storage service. Existing `web3_site_versions` stores validated schema/hash and a bounded build manifest. A hidden, archived `executive_agent_memory_items` system note stores gzip/base64 of the exact inert preview files, hashes and ownership binding. The archived record stays out of prompt memory. An internal clientNotes row links the draft receipt to the selected client.

Budgets: schema, manifest and compressed artifact summary each at most 60,000 UTF-8 bytes (safe for existing TEXT columns); uncompressed bundle at most 2,000,000 bytes and 40 HTML/CSS files. Oversize jobs fail before draft persistence; storage is not silently widened. These limits can exclude complex sites and are reported as failures, not success. No new database provisioner is called.

Version numbering is serialized on the existing site row; ownership/client binding and DRAFT status are checked again under lock. A nested transaction/savepoint rolls back partial draft writes even though the outer action dispatcher catches executor failures and records a failed approval. The canonical persisted approval/claim/lock/audit path remains authoritative; no new approve route or synthetic approval.

The preview lifetime is seven days. Expired records are no longer served; physical deletion is NOT automated by this draft and requires a separate retention cleanup design. Version/schema/client-note records persist. No new paid plan is introduced; existing DB storage consumes capacity, and bounds/expiry do not establish a zero storage cost.

Each HTML/CSS request to `/api/admin/executive-agent/stephon/preview/[versionId]/[...file]` independently verifies administrator session, current site and client ownership, artifact binding, expiry and hashes. No bearer-link access. Responses are private/no-store with a restrictive sandbox CSP and nosniff. Before storage, preview HTML loses scripts, forms, iframes, event handlers, remote assets/links and embeds; local links/styles are scoped to the protected route. CSS animation remains possible, but JS, external images/media/widgets/payments and forms are intentionally inert. This is a private review artifact, not a functional public deployment; a browser walkthrough is still required to validate styling/subresource behavior.

## Verification commands and remaining acceptance

- Local: `node --check tests/stephon/draft-database.test.mjs`.
- CI disposable MySQL 8.0 and standalone TiDB 8.5.4 use fixed loopback-only database/user from PR #19. The actual shared planner/generator/evaluator, new executor, actual Drizzle schemas, SQL/savepoints, compressor/sanitizer and private route run. getDb is bound to the disposable pool; model invokers are disabled test doubles; HTTP fetch is refused. No source SQL, transport, row or transaction double is used for these tests. Sessions use real signed fixture JWTs.
- `node --test tests/stephon/draft-database.test.mjs`: actual saved artifact/readback, no publication/current-version mutation, ownership refusal, expired/revoked/corrupt artifact denial, protected CSS/hashes, real savepoint failure rollback and sequential version numbering. This is not a production or configured-provider run.
- `node --test tests/engine-integration/gateway.test.mjs tests/executive-approval/approval-boundary.test.mjs tests/step2/*.test.mjs`: unchanged gate behavior and updated 14-entry discovery with fixture persistence/executors.
- Existing Pages API full-generation handler Jest regressions run after extraction. Results must be read from CI; no clean full-repository build/typecheck is presumed.

Still open: production schema/table availability, configured-provider pricing and execution, production concurrency/latency, live administrator preview/subresource/visual walkthrough, native Mac, site creation/selection UX, publication approval adapter, QR engine and membership collection. These changes do not verify live production generation or automatic end-to-end client delivery. All PRs remain draft; no merge, manual deployment, spending, production SQL or loop activation is performed.

## Verification infrastructure repairs discovered during execution

The existing Jest runner guard rejected the baseline test command because its manifest predated the two merged telemetry specs; it also had not classified the restored gateway spec. `tests/runner-selection.json` is synchronized with the unchanged package test command: telemetry specs belong to Node, gateway coordinator remains explicitly unlisted-from-npm Node and runs in dedicated CI. No runner guard is disabled or test removed.

The existing source-registry test requires explicit `name: executor` entries, so the new registry entry uses that form. New generic DB type-boundary casts are explicit and settings SQL results are array-checked. Full repository checking also exposed three already-produced planner/voice metadata fields absent from the response type (insightBlockCount, ambientVoiceBriefing and ambientPresenceMode). Their optional declarations now match existing runtime values; no voice/orchestrator behavior changes. Final typecheck comparison evidence belongs in the PR; the known baseline failures are not represented as a clean build.
