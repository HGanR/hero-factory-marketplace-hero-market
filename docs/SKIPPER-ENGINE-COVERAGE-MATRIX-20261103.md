# SKIPPER Engine Coverage Matrix — DRAFT

> **CORRECTION (2026-11-03, PR #23 preflight finding):** brief→schema generation already exists at `src/pages/api/site-builder/ai/pipeline.ts` (735 lines, at PR #22 head `c8e29c32`) and should be reused — the adapter must NOT build a duplicate first half. Still needed: ownership validation before provider use, saved-version persistence, and a private preview with receipts. A public IPFS deployment is publication, not a private preview. These findings come from source inspection; live generation remains unverified. See the Stephon row and the Bottom line, both corrected below.


**Date:** 2026-11-03
**Repo:** `HGanR/hero-factory-marketplace-hero-market`
**Audited head:** PR #21 `0db3b8c58e3d7414603f4439e1a3ca1e1e2adbcf`
(branch `feat/skipper-audited-engine-integration-20261103`, base
`feat/skipper-app-db-readiness-20261103` @ `bad4cbeaf92a8c3db7640d7a00af4f3ff602b26a`)
**Scope:** Documentation only. No code, schema, approval-gate, deployment, or
provider change. No live sends, builds, payments, or publications.
**Work package:** `docs/SKIPPER-MUSE-PARALLEL-WORK-20261103.md` (in PR #21).

## Method and evidence limits

Four read-only researchers plus direct reads by the lead. The PR #21 catalog
(`src/lib/executive-agent/engine-runtime-contract.ts`) was read in full at the
head SHA and used as the spine. Where an engine lives outside the PR #21 diff,
it was read at the PR #21 branch head and the ref is stated. `search_code` is
unreliable for this private repo (returns 0 results for known symbols, or
results from other repos); absence claims rest on directory listings plus
reading the named files, not on search. Line numbers are head-verified except
where marked provisional.

**Rate-limit caveat (material):** the GitHub connector returned HTTP 429
partway through the research. Per the hard-stop rule, no further calls were
made after that point in that task. The following were **not read** in the
inventory pass and are reported as **not evidenced**, not inferred:
`src/lib/revenue-os/market-sweep-synthesize.ts` (LLM provider/model for the
market sweep), `src/lib/revenue-os/market-signals/aggregateRealSignals.ts`
(whether the Reddit fetch is live), `src/lib/revenue-os/bentley-sync-launch-server.ts`
(campaign-sync internals), `src/lib/executive-agent/executive-action-payloads.ts`
(executor-side zod schemas, head excerpt only),
`src/lib/executive-agent/executive-inbox-site-project.ts`. The
`src/app/api/site-builder/*` route handlers were unread at inventory time
but were inventoried afterwards for the Stephon specification (see §3 and
the Stephon spec §2c): six handlers read in full, no 429 encountered.
That follow-up **changes** the Stephon finding — a schema → files →
public preview path exists and is reusable (deploy route), while a
brief → schema endpoint was not found in the routes read; the remaining
gap is `ai/intelligence/*`, `sites/[siteId]/versions/*`, the action
catalogue, and `src/lib/site-builder/intelligence/*`. Any handler still
unread there is marked as such in that spec — do not treat "no
generation path" as repo-wide fact until that inventory is complete.

**Live execution:** no engine in this matrix has live execution evidence.
Every finding is a static code read. The gateway integration test proves
routing/gating with fixtures, not that any real engine runs. CI for PR #21
(run 41625281490, recorded in the PR body after the audit) passed 79 tests
(10 gateway + 5 coordinator + 22 approval-boundary + 42 STEP 2), plus the
focused strict typecheck — that confirms the counted tests pass in CI; it
does not add live SQL/provider execution.

**Rule applied throughout:** do not mark something connected because a UI or
a function exists. A catalog entry, an intake note, a review document, or an
approval row is not a completed product.

## Shared gateway plumbing (applies to every catalog engine)

- Route: `POST /api/admin/executive-agent/engine-runtime`
  (`src/app/api/admin/executive-agent/engine-runtime/route.ts`). Auth:
  `getExecutiveAdminUserId(req)` reads `admin-token` / `auth-token` cookies,
  verifies an NPC admin JWT (`verifyNpcAdminJwt`, `npcJwtPayloadIsAdmin`, i.e.
  `isAdmin: true`), returns the numeric marketplace user id; no admin JWT →
  401. `POST` additionally enforces same-origin → 403 and a 32 KB body cap →
  413. `GET` returns the catalog + limits (including "Registered adapters are
  not proof of provider readiness or completed work" and "Stephon intake
  records a brief; it does not generate a website").
- Ownership: `ownedInput` (`engine-runtime-service.ts:13-22`) — a `clientId`
  must satisfy `clients.userId = adminUserId`; a `campaignId` must satisfy
  `campaigns.userId = String(adminUserId)`; else 404 "Client/Campaign
  unavailable to this account."
- Approval boundary for writes: `propose` inserts an
  `executiveAgentApprovals` row (`targetType: "engine:<id>"`, via
  `insertExecutiveApproval`); `approve`/`reject` invoke the canonical
  approve/reject POST handlers **in-process** (no self-HTTP, no alternate
  dispatcher). Execution goes through `executeExecutiveApprovedAction`
  (`executive-action-executors.ts:829-856`): it locks the persisted row
  (`lockExecutiveApprovalForExecution`), refuses unless status is exactly
  `"approved"`, takes action/payload **only from the persisted row**,
  dispatches via `EXECUTIVE_ACTION_EXECUTORS` (`:803-818`), and writes an
  audit row (`auditExecutor`, `executiveAgentAuditLogs`,
  `actionType: "approval_execute"`). Receipts come from `engineReceipt`:
  approval row + latest `approval_execute` audit row — and the code itself
  warns, for approved rows, *"Execution was claimed; a final receipt is not
  yet confirmed. Do not automatically retry."*
- Reads bypass approval by design (`engine-runtime-core.ts:38-41`): an
  `operation:"read"` on a `mode:"read"` engine returns
  `{engineId, status:"read_complete", observedAt, result}` directly, with no
  approval row and no `validateApprovalGate` call. Conversely, `propose` on
  a read-mode engine throws ("This engine is read-only"). Reads execute
  immediately on admin auth; they are read-only in effect, not propose-only.
  Read operations create no approval row, so a `receipt` operation for a
  read engine 404s ("Engine job not found"). The `read_complete` envelope is
  ephemeral, not persisted.
- **Gateway test coverage is fixture-based, not live-engine proof:**
  `tests/engine-integration/gateway.test.mjs` bundles the REAL gateway route,
  contract, core, service, canonical approve/reject routes and gate functions
  — but stubs auth, persistence, executor/provider transport, read tools, and
  inbox stores as test doubles. All 9 read tools are stubbed to return
  `{source:'<name>',fixture:true}`. The test proves routing, gating, and
  receipt logic; it does **not** prove any real engine works.

## The catalog (PR #21, 13 registered adapters)

From `src/lib/executive-agent/engine-runtime-contract.ts` (head-verified). The
contract header states: "Registered server adapters only. These descriptors
do not grant execution authority."

| # | Engine id | Agent | Mode | Purpose (contract wording) |
|---|-----------|-------|------|----------------------------|
| 1 | executive.inbox | skipper | read | Read the latest 120 Executive Inbox messages and up to 2500 approved active recipients. This does not send a message or read external email. |
| 2 | company.accounts | skipper | read | Current pending and approved account counts; not collected payments. |
| 3 | company.analytics | skipper | read | Recorded website analytics and attribution, with their source limits. |
| 4 | agents.overview | skipper | read | Website agent coordination and capability inventory; routing is not execution. |
| 5 | bentley.outputs | bentley | read | Existing owned campaign outputs. |
| 6 | stephon.projects | stephon | read | Owned website project status. |
| 7 | eleanor.operations | eleanor | read | Account-scoped fulfillment operations overview; not an assertion of collected revenue. |
| 8 | jarva.smart_trust | jarva | read | Account-scoped Smart Trust fulfillment status; not legal execution or desktop readiness certification. |
| 9 | reality.engagement | reality | read | Recorded engagement summary; no outbound messages. |
| 10 | skipper.knowledge | skipper | read | Existing website knowledge-base summary; not proof every document was read. |
| 11 | bentley.market_research | bentley | approval | Execute the existing Reddit market-sweep pipeline. Configured inference may incur provider charges. No publication. |
| 12 | bentley.campaign_drafts | bentley | approval | Synchronize an owned campaign into unscheduled drafts using the existing executor. No scheduling or publication. |
| 13 | stephon.intake | stephon | approval | Record an owned client's website brief as an internal intake note. This does NOT build a website. |

**Out of this matrix's scope, noted:** `company.accounts`,
`company.analytics`, `agents.overview`, `reality.engagement` are catalog
adapters not inventoried in depth here. One exception: `skipper.knowledge`
(`getKnowledgeBaseSummary`, `executive-agent-tools.ts:334`) returns a
hardcoded placeholder — "Knowledge base integration is not wired —
placeholder summary only." — so that catalog entry is a stub, not a working
engine.

## Coverage summary

| Engine | In catalog? | Mode | Callable server engine? | Produces a durable artifact? | Approval boundary? | Live execution evidence? |
|---|---|---|---|---|---|---|
| Executive Inbox | yes (read) | read | Yes — real DB read | No (transient JSON only) | None for the read | None |
| Bentley — outputs | yes (read) | read | Yes — real DB read | No (status metadata only) | None for the read | None |
| Bentley — market research | yes (approval) | approval | Yes — real pipeline | No (result discarded; 3 counts in audit log only) | Propose-only + canonical gate | None |
| Bentley — campaign drafts | yes (approval) | approval | Yes — writes `campaignPosts` rows | Yes — `campaignPosts` DRAFT rows | Propose-only + canonical gate | None |
| Stephon — actual website generation | no (only `stephon.projects` read + `stephon.intake` note) | — | No generation engine exists in the gateway chain | No (a `clientNotes` brief row only) | Propose-only for the note; nothing to approve for generation | None |
| Coding Agent | no | — | Yes locally (Python agent); not via the website gateway | Code changes / transcripts, local only | Human approval gate (paired); no website approval-row path | Yes for local runs; none website-triggered |
| QR Maker | no | — | No — browser-only + config-save route | No (PNG/SVG are browser downloads; server stores a URL string) | None | None (server-side) |
| Seal Maker | no | — | No — browser-only canvas; certificates route is storage-only | No (PNG/JPG are browser downloads) | None | None |
| Accounting / fulfillment (eleanor.operations) | yes (read) | read | Yes — real aggregation | No (transient JSON overview) | None for the read | None |
| Smart Trust (jarva.smart_trust) | yes (read) | read | Yes — real status aggregation | No (transient JSON summary) | None for the read | None |
| Avatar Studio | no | — | No — browser studio + preset CRUD | No (JSON download client-side; no GLB/image generated) | None | None |
| World building | no | — | Yes for persistence (GET/PUT placements); browser-only for building | Saved scene rows only; no build step | None — and PUT is any-authenticated-user | None |
| REN | no | — | Partial locally; not via the website gateway | Brief / blueprint JSON only; no GLB | Reviewed-blueprint gate; no website approval-row path | Partial (local analysis); pipeline stops at "brief received" |
| TAYO | no | — | Partial locally (Blender); not via the website gateway | GLB + geometry report, local only | Reviewed-blueprint gate + evidence gating; no website approval-row path | Yes for local Blender builds; none website-triggered/served |

## 1. Executive Inbox — catalog `executive.inbox` (skipper, read)

- **Input schema:** `z.object({}).strict()` — no input (`engine-runtime-contract.ts`, `InputSchemas["executive.inbox"]`).
- **Authenticated owner/client mapping:** Admin JWT only (shared plumbing). **No owner/client scoping at all:** `listDepartmentMessagesForExecutiveAdmin` (`src/lib/executive-agent/executive-department-inbox-store.ts:128-134`) is an unfiltered `select()` from `executiveDepartmentMessages`, `orderBy(createdAt desc).limit(120)` — every department message. `listApprovedMarketplaceUsers` (`:136-147`) returns `{id, username, email}` for **all** `marketplaceUsers` where `isApproved=true AND isActive=true`, limit 2500. The per-user filtered variant `listDepartmentMessagesForMarketplaceUser` (`:113-126`) exists but is **not** called by the gateway.
- **Concrete entry point:** `POST /api/admin/executive-agent/engine-runtime` → `operateEngine` → read branch `engine-runtime-service.ts:44-47`: `Promise.all([listDepartmentMessagesForExecutiveAdmin(db, 120), listApprovedMarketplaceUsers(db, 2500)])`.
- **Existing approval boundary:** None for the read (executes on admin auth; no approval row, no gate). Sending is a separate surface (`insertUserToExecutiveMessage` / `insertExecutiveBroadcast` / `insertExecutiveToUserMessage`, `:49-111`) — **not** wired into this gateway route.
- **Returned artifact(s):** Transient JSON only — full message rows (all columns, `bodyText` up to 20,000 chars, `metadataJson`, `attachmentsJson`) plus the recipient directory. No file, record, or message is created by the read.
- **Storage destination:** Reads `executiveDepartmentMessages` and `marketplaceUsers` (TiDB/MySQL via Drizzle). No write destination for the read itself.
- **Job/receipt format:** None. No audit-log write was evidenced in this read branch.
- **Dependencies:** Internal only — Drizzle/MySQL. No external email provider; no external fetch on read. Attachment URLs in `attachmentsJson` point at IPFS gateways (Pinata / nft.storage) but are returned as strings, never fetched or validated by the gateway read. Companion files: `executive-inbox-attachments.ts` (validation/upload, `PINATA_JWT`) — gateway use effectively none (only the constant `EXECUTIVE_INBOX_ATTACHMENTS_JSON_MAX` is imported); `executive-inbox-site-project.ts` (`probeSiteProjectZipBuffer`, `extractBuilderSchemaJsonFromZipBuffer`) — gateway use none.
- **Missing acceptance proof:** (a) No live signed-in execution against a real database. (b) No evidence returned rows match what the Executive Inbox UI displays. (c) The unfiltered admin-wide read is by design but unconfirmed as intended policy vs. an over-broad read.
- **Classification:** Callable server engine — yes (real server-side read adapter). Browser-only — no. Provider readiness — n/a. Live execution evidence — none.

## 2. Bentley research / campaigns — three catalog surfaces

### 2a. `bentley.outputs` (read) — `getBentleyCampaignOutputs`

- **Input schema:** `{ campaignId: z.string().uuid().optional() }`, strict. Gateway passes only `{campaignId}`.
- **Authenticated owner/client mapping:** `ownedInput` verifies `campaignId` belongs to the admin (`campaigns.userId = String(adminUserId)`) **before** dispatch. The tool itself (`executive-agent-tools.ts:203-251`) does **no** ownership check — ownership lives only in the gateway layer. The tool's client-list branch (`:232-251`) is unreachable via the gateway; with no `campaignId` it returns `{ message: "Provide selectedClientId or campaignId for Bentley outputs." }`.
- **Concrete entry point:** `POST /api/admin/executive-agent/engine-runtime` → read case `"bentley.outputs"` → `getBentleyCampaignOutputs` (`executive-agent-tools.ts:203`).
- **Existing approval boundary:** Read-only; no approval row.
- **Returned artifact(s):** Status rows only — no generated content. With `campaignId`: `{ campaignId, name, status, hasBentleyPayload: Boolean(camp.bentleyGenerationJson), posts }`, where `posts` (max 50) carries only `{ id, platform, status, scheduledAt }` — no post body/text. The `bentleyGenerationJson` payload itself is **never returned**, only a boolean flag.
- **Storage destination (read from):** DB tables `campaigns` (incl. `bentleyGenerationJson`, presence-checked only) and `campaignPosts`.
- **Job/receipt format:** None — synchronous read; no job record, no audit log entry evidenced for reads.
- **Dependencies:** Internal only — Drizzle + `campaigns`/`campaignPosts`. No external provider.
- **Missing acceptance proof:** Live read against a real DB with a campaign that actually has `bentleyGenerationJson` set; proof of what writes `bentleyGenerationJson` (no writer traced in this pass); confirmation that the client-list branch is intentionally dead via the gateway.
- **Classification:** Callable server engine — yes (working DB read, metadata only). Browser-only — no. Provider readiness — n/a. Live execution evidence — none.

### 2b. `bentley.market_research` (approval → `triggerBentleyAnalysis`, mode `market_sweep`)

- **Input schema:** Contract: `{ clientId: UUID, industry: string (trim, 2–200 chars), targetAudience?: string (trim, max 400) }`, strict. `writeActionForEngine` maps it to `{ action: "triggerBentleyAnalysis", payload: { …clean, mode: "market_sweep" } }`. Executor-side schema not read (rate-limited); executor destructures `{ mode, campaignId, clientId, industry, targetAudience }` (`executive-action-executors.ts:264-275`).
- **Authenticated owner/client mapping:** `ownedInput` verifies `clients.userId = adminUserId`; executor re-checks with `assertClientOwnedByAdmin` (`:303-310`).
- **Concrete entry point:** Gateway `POST …/engine-runtime` → `propose` → `approve` → `executeExecutiveApprovedAction` → `EXECUTIVE_ACTION_EXECUTORS["triggerBentleyAnalysis"]` (`:809`) → `runTriggerBentleyAnalysis` (`:264`). Market-sweep branch `:303-336` calls `runMarketIntelligenceSweepPipeline({ industry, targetAudience, platforms: ["reddit"], clientId, trustId: "", userId: String(adminUserId) })` (`:313-320`). Note `trustId` is passed as an **empty string**.
- **Existing approval boundary:** Propose-only + canonical approve handler + persisted-approved-row lock. `mode: "full_lifecycle"` explicitly refused (`:277-284`); `mode: "analysis"` is a read-only snapshot (`:285-301`). No publication in any branch.
- **Returned artifact(s):** Effectively none durable. Executor returns only `{ bucketCounts: { trending, hooks, painPoints } }` (`:322-331`) — three integers. The full sweep result is **discarded**; the pipeline returns it in memory and the executor does not store it. Only durable record is the approval row plus the `approval_execute` audit log entry (message + bucket counts).
- **Storage destination:** None for the research output — no insert/save call visible in `market-sweep-pipeline.ts`. The pipeline only *reads* a prior snapshot for hybrid finalization; whether `finalizeMarketSweepHybrid` or `aggregateRealMarketSignals` persist anything internally was **not read**.
- **Job/receipt format:** Approval row + `approval_execute` audit log entry. No job record, no snapshot id, no result id returned.
- **Dependencies:** Internal: `market-sweep-pipeline.ts` → `aggregateRealMarketSignals` (`market-signals/`), `synthesizeMarketSweepWithLlm` + `buildDeterministicMarketSweepParsed` (`market-sweep-synthesize.ts`), `finalizeMarketSweepHybrid`, `persist-market-intelligence`, `youtubeConnector.isConfigured()`. External/paid: **not evidenced**. Pipeline header says "real signal fetch → LLM or deterministic buckets → hybrid finalize"; code tries LLM first, falling back to deterministic buckets with `console.warn("[market-sweep] LLM synthesis unavailable, using deterministic buckets: …")` (`:71-77`) — but provider/model/key were not read. Caution flags: (a) `connectedIntegrations` hardcoded to `["reddit"]` (`:110`) regardless of fetch success — not evidence of a live Reddit call; YouTube appended only if `youtubeConnector.isConfigured()`. (b) Executor discards the pipeline's `llmUsed` / `llmError` return values, so the caller cannot tell whether output was LLM-synthesized or deterministic fallback.
- **Missing acceptance proof:** (1) Read `market-sweep-synthesize.ts` (provider, model, key env, cost) and `aggregateRealSignals` (is Reddit a real authenticated fetch?); (2) confirm or correct the "LLM-emulated with mock fallback" finding — fallback structure confirmed, provider identity and Reddit reality not; (3) a live run proving a real (non-empty, non-template) result, with `llmUsed` surfaced; (4) a persistence decision — currently the research evaporates except for three counts; (5) whether `trustId: ""` breaks feedback aggregation/prior-snapshot lookup.
- **Classification:** Callable server engine — yes (approval-gated, pipeline executes end-to-end in code, with an `assertUsableSweep` guard). Browser-only — no. Provider readiness — **not evidenced**. Live execution evidence — none.

### 2c. `bentley.campaign_drafts` (approval → `triggerCampaignSync`)

- **Input schema:** Contract: `{ campaignId: UUID }`, strict. `writeActionForEngine` maps it to `{ action: "triggerCampaignSync", payload: { …clean, dryRun: false } }`. Executor destructures `{ campaignId, dryRun }` (`executive-action-executors.ts:339-348`).
- **Authenticated owner/client mapping:** `ownedInput` verifies campaign ownership; executor re-checks via `assertCampaignOwnedByAdmin` (`:349-350`).
- **Concrete entry point:** Gateway → `propose` → `approve` → `executeExecutiveApprovedAction` → `EXECUTIVE_ACTION_EXECUTORS["triggerCampaignSync"]` (`:810`) → `runTriggerCampaignSync` (`:339`). Non-dry-run branch `:366-393` calls `syncBentleyCampaignPostsAndSchedule(ctx.db, input)` from `@/lib/revenue-os/bentley-sync-launch-server` (import `:63`).
- **Existing approval boundary:** Propose-only + canonical approve handler + persisted-approved-row lock, plus `assertSafeExecutiveCampaignSyncInput(input)` (`:375`) before sync. `dryRun: true` short-circuits to read-only ("Dry run — no posts created or updated", `:352-364`); the gateway always sends `dryRun: false`.
- **Returned artifact(s):** `campaignPosts` rows created as drafts: executor returns `{ created, skipped, rescheduled, postIds (first 20), requireApproval }` (`:380-389`) with message "Campaign posts synced as drafts only (no schedule/publish in this executor)." A "draft" in storage is a `campaignPosts` row with `status: "DRAFT"` and `scheduledAt: NULL`. Post content comes from the campaign's existing `bentleyGenerationJson` payload — this executor generates no new copy.
- **Storage destination:** DB table `campaignPosts`; source payload read from `campaigns.bentleyGenerationJson`.
- **Job/receipt format:** Approval row + `approval_execute` audit log entry; the executor result (counts + post ids) lands in the audit `outputJson`. No separate job/receipt record.
- **Dependencies:** Internal sync function; external/paid **none evidenced at the executor layer** — `content360PlatformSchedule: false` passed explicitly. Sync input: `{ userId, campaignId, scheduleStrategy: "immediate", postCreationMode: "draft_unscheduled", content360PlatformSchedule: false, requireApprovalOverride: true }` (`:366-373`).
- **Can it publish or schedule?** At the executor layer, no. **But the sync function's internals were not read** (rate-limited), and `scheduleStrategy: "immediate"` is ambiguous on its face. Treat "cannot publish" as **executor-level evidenced, sync-level unverified**.
- **Missing acceptance proof:** (1) Read `bentley-sync-launch-server.ts` (confirm draft-only, explain `scheduleStrategy: "immediate"` and the `rescheduled` counter, confirm no Content360 publish call); (2) live run on a campaign with a real `bentleyGenerationJson` payload showing rows created as `DRAFT`/`scheduledAt NULL` and nothing `SCHEDULED`; (3) what happens when `bentleyGenerationJson` is absent (dry-run branch reports `hasBentleyPayload`, live branch does not check it first).
- **Classification:** Callable server engine — yes (approval-gated, writes real `campaignPosts` rows). Browser-only — no. Provider readiness — n/a at executor layer, pending sync-file read. Live execution evidence — none.

### 2d. The bridge — `bentley-executive-bridge.ts` (NOT used by the gateway)

Read-only rollup (`summarizeBentleyExecutiveBridge`; `summarizeBentleyLaunchReadinessForClient`). Reports latest 8 `bentley_cadence_runs` rows; count of campaigns with a `bentleyGenerationJson` payload; count of `SCHEDULED` posts; count of `DRAFT`/`FAILED` posts with `scheduledAt NULL`; count of pending `executiveAgentApprovals` for the admin; `content360PlatformConfigured` (boolean from env). Each subsection degrades independently (errors become `notes[]`, counts become `null`). It writes nothing and triggers nothing. **The gateway does not use it.** Its only relevance here is corroborating evidence for what "draft" means in storage and that a `bentley_cadence_runs` table exists.

## 3. Stephon — actual website generation (DEPTH PRIORITY; full specification in the companion spec doc)

**Verdict: confirmed in code — the gateway's Stephon path records a brief; it does not generate a website.** `stephon.intake` maps to executor action `createSiteBuilderTask`, whose entire effect is one `INSERT` into `clientNotes` with the literal footer `(No live site schema mutation from this action.)` and return message `"Site Builder task captured as internal note (intake only)."` No file write, no HTML generation, no build, no publish, no preview URL exists anywhere in the contract → executor chain. The read side (`stephon.projects`) is a bounded `SELECT` of existing `web3Sites` rows. The separate `src/app/api/site-builder/*` tree was inventoried afterwards for the Stephon specification (six handlers read in full; see the Stephon spec §2c). That follow-up **changes the repo-wide picture in one direction only: a schema → files → public preview path EXISTS and is reusable** — `sites/[siteId]/deploy/route.ts` takes a saved version's `schemaJson`, generates a static bundle (`generateStaticBundle`), uploads it to IPFS via Pinata, stores `ipfsCid` + `buildManifestJson` on `web3SiteVersions`, marks the site `PUBLISHED`, and returns `https://gateway.pinata.cloud/ipfs/<cid>`; `export/route.ts` proves the same schema→files step works without a saved site (ZIP download). **CORRECTED 2026-11-03 (PR #23): the first half EXISTS — it was outside the six-handler inventory, at `src/pages/api/site-builder/ai/pipeline.ts`** (POST-only, session-auth, steps `plan`/`full`/`generate`; `full` runs `runSitePlanner` → `generateSiteSchemaFromPlanner` with content intelligence/critique, evaluation, and generation-intelligence persistence, returning schema, alternates, `generationMeta`, `intelligenceRunId`). The "not found" statement was scoped to the six `src/app/api/site-builder/*` handlers read. The adapter **reuses** that pipeline; it does not build a duplicate. What the adapter must still add: ownership validation before provider use (the pipeline authenticates a user, it does not check client/site ownership), persisting the generated version as a `web3SiteVersions` row, and a private preview with receipts — a public IPFS deployment is publication, not a private preview. These findings come from source inspection; live generation remains unverified. The deploy route has **no approval boundary** — a single owner call publishes publicly — so the adapter must supply gating and a preview-only variant (deploy conflates preview and publish).

- **`stephon.projects` (read) — `getSiteBuilderProjectStatus` (`executive-agent-tools.ts:268-284`):** Input `z.object({}).strict()` — no input fields; client scoping comes from server-side context (`selectedClientId`), not the request body. Selects `{id, name, status, updatedAt}` from `web3Sites` where `web3Sites.clientId = cid`, `ORDER BY updatedAt DESC LIMIT 20`; returns `{clientId, sites}` or `{sites: [], message: "No client id."}`. Gateway's `ownedInput` only fires when `clientId`/`campaignId` is present in request input, which never happens for this read — ownership enforcement is the admin-JWT gate plus whatever sets `selectedClientId`, not a per-client check in the tool itself. Full `web3Sites` schema/status enum not read. **Classification:** callable server read — yes. Live evidence — none.
- **`stephon.intake` (approval → `createSiteBuilderTask`):** Input `{ clientId: UUID, title: string (trim, 1–500), instruction: string (trim, 1–20000) }`, strict. Catalog purpose: "Record an owned client's website brief as an internal intake note. This does NOT build a website." Executor-side schema is a **superset** (adds `pageSlug` optional/nullable and `priority` low/normal/high, default normal) — but `writeActionForEngine` passes only the contract-validated `{clientId, title, instruction}`, so a gateway-proposed intake can never carry `pageSlug` or `priority` (they silently default). Entry: `runCreateSiteBuilderTask` (`executive-action-executors.ts:700-734`; registered `:811`); `assertClientOwnedByAdmin` before any insert. Complete effect: a single `clientNotes` insert (`visibility: "internal"`, author = approving admin), returning `{ok:true, status:"executed", message:"Site Builder task captured as internal note (intake only).", data:{clientId, clientNoteId}}`. No `web3Sites` insert/update, no task/queue row, no file, no HTML, no build, no publish, no preview URL. The name `createSiteBuilderTask` is misleading — no task entity exists; the "task" is the note. Post-execution hook (call site only): `linkSiteBuilderDraftToFulfillmentDeliverable(db, {adminUserId, approvalId, clientNoteId, payload})` (`:924-935`) — body **not read**; downstream bookkeeping on the note, not generation. Approval boundary: propose-only, approval-gated; execution re-reads the persisted row, refuses unless `status === "approved"`, dispatches from persisted `proposedAction`/`payloadJson`; audit entry per execution. Dependencies: internal only — Drizzle/MySQL, zod, `crypto.randomUUID`, approvals store, audit, policy, fulfillment-deliverable-draft. **No external provider, no LLM call, no paid service.**
- **Second, distinct "site builder" read surface — `buildStephonSiteBuilderOverview` (`stephon-site-builder-service.ts:105-231`):** NOT `web3Sites`. Resolves the Stephon NPC (`npcId = "site-builder-stephon"`, world `"site-builder"`) and reads OASIS conversation tables only (`oasisNpcs`, `oasisNpcSessions` last 30 days, `oasisNpcMessages`). Returns `{ok, generatedAt, worldId, worldLabel: "Site Builder", engineId: "site-builder-engine", npcConfigured, npcId, npcName, totals, sessions, skipperBrief, usabilityThemes, meta: {readOnly: true, piiMasked: true, skipperCanAccessTranscripts: true}}`. Constants: `SITE_BUILDER_ENGINE_ID = "site-builder-engine"`, comment `/** Platform desk scope — not a 3D world building. */`. "Project status" here means "what operators discussed with the Stephon NPC in the last 30 days" — do not conflate with `stephon.projects`. Persona copy (`stephon-persona.ts`): "I'll help you plan, generate layouts, refine copy…" / "You do not deploy, publish, charge, or mutate production without the user's explicit save/deploy actions in the builder UI." Persona copy is **not** a code path — "generate layouts" is ungrounded until the `site-builder/ai` handlers are read.
- **Current build/preview storage:** Generated files — none evidenced in the gateway chain. No `public/` write, no bucket, no external host referenced. Preview receipts — none. What exists: `clientNotes` (brief), `web3Sites` (existing site rows, read-only from this surface), OASIS NPC tables (conversation history), `executiveAgentApprovals` + audit log. Client linkage is `clients.id` (UUID) with ownership via `clients.userId = adminUserId`; no evidenced link to a generated site, an end-client `userId`, or a preview host.
- **Missing acceptance proof / adapter must add:** see the Stephon specification (corrected 2026-11-03). The brief→schema pipeline exists (`src/pages/api/site-builder/ai/pipeline.ts`, step `full`) and is reused. The adapter must add: ownership validation before provider use, saved-version persistence, a private preview with receipts, and explicit handling of the global-provider fallback and deterministic/generic-content warnings in `generationMeta`. Live generation remains unverified (source inspection only).

## 4. Coding Agent (skipper repo) — NOT in the catalog

**Repo + ref:** `HGanR/skipper`, default branch head `e46d7a4b9ab29395ed29201fe54b47a2023f9e86` (verified via commit/file listing). STEP 2 charter work is PR #52 at `f6e8b7b1` (draft, unmerged; audited 5/5 PASS).

- **What it is (prior verified record + README opening, read in this task):** A Python coding agent — "an OpenAI-compatible local model, a Python while-loop, real tools, a Docker sandbox, and a human approval gate" (README). Core loop: `task → inspect repo → run tests → edit code → run tests → fix → summarize`. Across 9 single-variable experiments on a frozen benchmark, qwen2.5-coder:7b went from 38% → 81% strict success. Key files (existence verified from root listing; line-level content **not** re-read in this task due to the rate limit): `agent.py` (32,284 B), `tools.py` (36,054 B), `prompts.py`, `sandbox.py`, `agent_delegation.py`, `mcp_bridge.py`, `worktree_manager.py`.
- **Input schema:** A task (text, optionally with attached files — PDFs text-extracted, images sent as multimodal messages) plus a target repository/checkout. (Prior verified record; exact task schema/CLI signature not re-read.)
- **Authenticated owner/client mapping:** Not evidenced in this task. Runs locally on the paired Mac (USB path `/Volumes/OWEN-USB/coding-agent/coding-agent`); invoked by the operator/Desktop; no website-side authenticated owner/client mapping. Not evidenced whether it performs any server-side ownership check before acting on a repo.
- **Concrete entry point:** Paired Desktop (sends commands, uploads handoffs) and Studio (paired run path), or directly via local CLI/web UI on the paired Mac. Exact entry-point file/line not re-read (rate limit).
- **Existing approval boundary:** Human approval gate (README). Runs code tasks **when asked**; does not self-initiate. **No** website approval-row path — not governed by `validateApprovalGate` or executive-agent approval rows. Its boundary is the operator's approval in the paired Desktop/Studio flow.
- **Returned artifact(s):** Code changes (edits, new files, test results, summary) in the target repository/worktree, plus per-run transcripts in `logs/`. No website artifact. (Prior verified record.)
- **Storage destination:** Target repository (local checkout/worktree on the paired Mac); transcripts in `logs/`; draft PRs on GitHub when published.
- **Job/receipt format:** Per-run transcripts in `logs/` (JSON), plus Conversations (browsable/renamable/deletable) in the web UI. No website-side job record or approval-row receipt.
- **Dependencies:** Local OpenAI-compatible model (qwen2.5-coder:7b in the benchmark), Docker sandbox, Git, Node/Python tooling on the paired Mac. No paid provider required for the local path.
- **Missing acceptance proof:** (1) No evidenced path for the Coding Agent to act as an MCP client (GitNexus question open; `mcp_bridge.py` exists but its contents were **not** read — whether it lets the agent *call* MCP tools or only *serve* them is not established). (2) No website-side invocation or approval path — the gateway cannot call it. (3) No live evidence of a website-triggered Coding Agent run.
- **Classification:** Browser-only — no. Callable server engine — yes locally (real, runnable agent on the paired Mac, benchmark evidence), but **not** callable from the website server/gateway. Provider readiness — partial (local model path proven). Live execution evidence — yes for local runs; **none** for website-triggered execution.

## 5. QR Maker (DEPTH PRIORITY; full specification in the companion spec doc) — NOT in the catalog

A full client-side QR generator page, **not** a server engine. `src/app/qr-maker/page.tsx` (915 lines, `"use client"`): `import QRCode from "qrcode"` (line 5); `isProbablyUrl()` — `new URL(value)`, only `http:`/`https:` accepted (lines 35–40); `finalUrl` — valid URL only, unique mode appends `?qrid=<uuid>` (lines 225–228); `QRCode.create(finalUrl, { errorCorrectionLevel: ecc })`, then a custom canvas renderer (square/rounded/dots/squircle, custom finder eyes, gradient, contrast-based scan-safety score, lines 230–339); `downloadPng()` — `canvas.toDataURL("image/png")` → browser download (`qr_<token8>.png`, lines 429–435); `downloadSvg()` — rebuilds from `QRCode.create`, serialises hand-built SVG → browser download (lines 438–528); `saveToWorkspace()` — `POST /api/app/qr-save` with `{ workspaceId, name, config: { url: finalUrl, token, uniqueMode } }` (lines 549–586). Workspace id from `localStorage` key `smart_trust_platform_binding_v1`.

- **Input schema:** No zod/server schema. Client state: `rawUrl`, `ecc` (L/M/Q/H), `moduleShape`, `sizePx`, `quietZone`, colours, `uniqueMode`+`token`. Save body: `{ workspaceId, name, config:{url,token,uniqueMode} }`.
- **Authenticated owner/client mapping:** Save: `requireUserId(req)` + `trusts.userId === userId` else 403 (`qr-save/route.ts`). Owner = trust owner. Rendering/download itself: no auth (public page, client-only).
- **Concrete entry point:** Page `src/app/qr-maker/page.tsx` (`renderQr`, line 348); save `POST /api/app/qr-save`. **No server QR-render route exists.**
- **Existing approval boundary:** **None.** No approval row, no `validateApprovalGate`, no propose-only path. Save is direct execution after auth+ownership. Download needs no auth at all.
- **Returned artifact(s):** Browser-downloaded PNG/SVG (client); save returns `{ id, workspaceId }` only.
- **Storage destination:** `trustAssets` table, `assetType="qr_code"`, config JSON in `description`. **No image bytes stored anywhere.** Server (`qr-save/route.ts`, 61 lines, POST only) stores the config (URL string) only — no PNG/SVG bytes, no server-side QR rendering, no file/bucket.
- **Job/receipt format:** None — only the `trustAssets` row + `{ id, workspaceId }` response. No job, receipt, or audit entry.
- **Dependencies:** `qrcode` npm package (imported, **not declared in `package.json`** — needs a clean-build check; whether it resolves transitively/via a lockfile was not verified); `drizzle-orm`, `getDb`, `requireUserId`. No external provider, no paid service.
- **URL validation / encoding:** Client: http/https only, no allowlist/blocklist, no length cap beyond the scan-safety warning at >120/200 chars. Encoding by the `qrcode` library's `QRCode.create` on the final URL string. **Server: no validation at all** — `qr-save` copies `config.url` into the stored JSON verbatim; it never parses the URL.
- **SSRF surface:** **None evidenced.** No code in the QR page or `qr-save` ever `fetch()`es the user-supplied URL — the only `fetch` is the `POST /api/app/qr-save` save call. (Risk note: the stored URL string is later rendered/consumed by whatever reads `trustAssets` — that consumer was not traced; no fetch of it was found in the files read.)
- **Decode test:** **Not found / not evidenced.** No QR spec in the `package.json` test script; no decode/round-trip step in the page or route. The page's only correctness signal is its own heuristic scan-safety score — not a decode.
- **Missing acceptance proof:** (1) Resolve the `qrcode` dependency / prove a clean build; (2) a decode test proving generated codes scan to the intended URL (incl. styled variants); (3) server-side URL validation if the stored URL is ever fetched/rendered elsewhere; (4) any approval/receipt design if Skipper is to invoke it.
- **Classification:** Browser-only — **yes**. Callable server engine — **no**. Provider readiness — n/a. Live execution evidence — none for a server-side QR operation (none exists).

## 6. Seal Maker — NOT in the catalog

A browser-only design canvas, **not** a server engine. `src/app/seal-maker/page.tsx` (923 lines, `"use client"`): `react-konva` elements (text/arcText/circle/ring, position, colour, font, rotation); `PAYMENT_CONFIG` — Polygon chain 137, TROO token `0xa7927231898293377Ce676CFC9bbD551Cb845695`, recipient `0x5c8B7C050d7E83E01A278bE24d578A4Daf3e17EF`, `PAYMENT_AMOUNT = 60` TROO; payment is a client-side `wagmi` ERC-20 `transfer` of 60 TROO; `transferSuccess` sets `paymentCompleted=true`; `handleDownload()` gated on `paymentCompleted` (client state only), exports PNG/JPG via `stage.toDataURL({ pixelRatio: 2 })` as a browser download; SVG export is **not implemented** (alerts "Please use PNG format"). **No `fetch`, no `/api/` call, no save anywhere in the page.** No server verification of the 60-TROO payment exists in this file.

- **Nearest server thing — certificates API (separate, not wired to this page):** `src/app/api/certificates/route.ts`: `POST /api/certificates` — **no authentication at all** — accepts a client-supplied `walletAddress` plus five client-supplied data-URLs (all required) and optional `renderDataUrl`/`certificateJson`; inserts into `dashboard_certificates`. **No server rendering, no seal/QR/barcode generation, no validation of wallet format or image contents** — it stores whatever data-URLs the caller posts. `GET /api/certificates?wallet=<addr>` also unauthenticated. No caller of this POST was found in `seal-maker/page.tsx`. Which client (if any) posts certificates was **not established**.
- **Input schema:** No server schema. Client state: element list, `plateSize`, `plateShape` (circle/square/triangle), colour. Certificates POST body: `{ walletAddress, assetAddressUrl, sealDataUrl, watermarkDataUrl, qrDataUrl, barcodeDataUrl, noticeQrDataUrl, renderDataUrl?, certificateJson? }` — no zod/schema, no auth.
- **Authenticated owner/client mapping:** Seal page: wallet connection via wagmi for payment only; no server-side owner mapping. Certificates POST: **none** — identity is a caller-supplied `walletAddress` string.
- **Existing approval boundary:** **None.** Download gate is client-side `paymentCompleted` state; no server payment verification, no approval row, no `validateApprovalGate`. Certificates POST is direct execution with no auth at all.
- **Returned artifact(s):** Browser-downloaded PNG/JPG (client). Certificates POST returns `{ ok: true }` only; artifact is the stored `dashboard_certificates` row of client-supplied data-URLs.
- **Storage destination:** Seal design: **none** (not saved anywhere). Certificates: `dashboard_certificates` (created on demand by the route itself via `CREATE TABLE IF NOT EXISTS`).
- **Job/receipt format:** None. (On-chain TROO transfer receipt exists only in the user's wallet, not in the app.)
- **Dependencies:** `react-konva`/`konva`, `wagmi`/`viem` (client); TROO ERC-20 on Polygon (60 TROO, on-chain transfer, no paid third-party service). Certificates route: raw SQL via `getConnection`.
- **Missing acceptance proof:** (1) Server-side verification of the 60-TROO payment before download (currently bypassable client-side); (2) any server seal renderer or a wired save path from the Seal Maker page to `dashboard_certificates`; (3) auth + ownership on `POST /api/certificates`; (4) SVG export (advertised, unimplemented).
- **Classification:** Browser-only — **yes**. Callable server engine — **no** (certificates route is storage-only, not a renderer). Provider readiness — no provider needed for the canvas; payment is on-chain but unverified server-side. Live execution evidence — none.

## 7. Accounting / fulfillment — catalog `eleanor.operations` (eleanor, read)

Catalog purpose: "Account-scoped fulfillment operations overview; not an assertion of collected revenue."

- **Input schema:** `z.object({}).strict()` — no input. Gateway calls it with `ctx` only (`service.ts:53`), so the tool's default `limit = 30` applies.
- **Authenticated owner/client mapping:** Admin JWT → `adminUserId`; owner-scoped: `buildExecutiveFulfillmentOperationsOverview` (`src/lib/fulfillment/fulfillment-operations-service.ts:524-691`) selects `clientServiceOrders` where `ownerAdminUserId = adminUserId` (`:545`), then joins only that owner's orders to `paymentConfirmations`, `fulfillmentDeliverables`, and `executiveAgentApprovals`. Per-client `buildClientFulfillmentOperations` and `buildExecutiveFulfillmentOperationsBriefing` exist in the same file but are **not** called by the gateway.
- **Concrete entry point:** `POST /api/admin/executive-agent/engine-runtime` → `service.ts:53` → `getExecutiveFulfillmentOperationsOverview(ctx)` (`executive-agent-tools.ts:826-835`) → `buildExecutiveFulfillmentOperationsOverview` (`:524`).
- **Existing approval boundary:** None for the read (executes on admin auth). Overview only *reports* approval status per order (`approvalStatus` from `loadLatestApprovalsByOrder`, `:117-150`, over `FULFILLMENT_ACTIONS` `:68-76`: `createSiteBuilderTask`, `createTrustFulfillmentPacket`, `createRevenueOsCampaignReviewPacket`, `recordRevenueOsLaunchReadinessCheckpoint`, `createSmartTrustGovernanceReviewPacket`, `recordSmartTrustResolutionCheckpoint`); it creates no approvals. One side effect: an audit row via `auditFulfillmentExecutiveAction` (`:667-676`, `toolName:"fulfillment.operations.overview"`, `actionType:"orchestration_overview_viewed"`, output = counts only). Business state untouched; `meta:{recommendationOnly:true, noAutonomousExecution:true}` returned (`:685-689`).
- **Returned artifact(s):** Transient JSON overview DTO: `{ok, generatedAt, totals:{activeOrders, stalledClients, pendingApprovals, websiteOrders, trustOrders, revenueOsOrders, smartTrustOrders}, bottlenecks, clients:[{clientId, healthScore, healthTier, stalled, activeDepartments, topRecommendation}], meta}`. Per-order snapshots carry `pipelineStage`, `approvalStatus`, `ownerReviewStatus`, `paymentStatus`, `paymentConsumed`, `daysInCurrentStage`, `campaignId`, `launchReadinessApproved`, `revisionRound`, `trustId`, `governanceReviewApproved`. No file, invoice, or ledger entry produced.
- **Storage destination:** Reads `clientServiceOrders`, `paymentConfirmations`, `fulfillmentDeliverables`, `executiveAgentApprovals` (TiDB/MySQL). Audit write to the fulfillment audit log. No other write.
- **Job/receipt format:** None for the read. Only durable record is the `orchestration_overview_viewed` audit entry (counts only, not a job receipt).
- **Dependencies:** Internal only — Drizzle/MySQL plus internal builders (`client-operations-graph`, `client-health-score`, `department-dependency-map`, `fulfillment-recommendation-engine`, `unified-client-timeline`, briefing/memory builders, handoff parsers). No external provider, no paid service evidenced in the read path.
- **Is there real accounting? No — operations overview only.** A grep of `fulfillment-operations-service.ts` (1,176 lines) finds **no** `ledger`, `invoice`, `amount`, `currency`, `Stripe`, `PayPal`, or `TROO` anywhere. Only money-adjacent data is `paymentConfirmations` read as a status flag: `status: pending|confirmed|failed`, `consumedAt`, `consumedByOrderId`. No amounts, no totals of money. The catalog's own wording — "not an assertion of collected revenue" — matches the code.
- **Missing acceptance proof:** (a) No live-DB execution evidenced. (b) No verification that `paymentConfirmations.status` reflects a real collected payment vs. a recorded claim (confirmation provenance — which route/provider writes it — was not traced). (c) No ledger/invoice capability exists to verify — any "accounting" claim would need a separate build, not a check.
- **Classification:** Callable server engine — yes (real server-side aggregation over live tables). Browser-only — no. Provider readiness — no. Live execution evidence — none.

## 8. Smart Trust — catalog `jarva.smart_trust` (jarva, read)

Catalog purpose: "Account-scoped Smart Trust fulfillment status; not legal execution or desktop readiness certification."

- **Input schema:** `z.object({}).strict()` — no input. Gateway calls it with `ctx` only (`service.ts:54`), so `orderId` is undefined and `clientId` is `ctx.selectedClientId ?? null` = null in this path (`tools.ts:498-510`); the gateway read therefore always returns the queue summary with `focusOrder: null`.
- **Authenticated owner/client mapping:** Admin JWT → `adminUserId`; owner-scoped via `listSmartTrustFulfillmentQueueForAdmin` (`src/lib/fulfillment/smart-trust-operations-service.ts:164-267`), which filters `clientServiceOrders` by `ownerAdminUserId = adminUserId` AND `primaryService = SMART_TRUST` AND `assignedDepartment = SMART_TRUST` (`:177-180`), limit 25 in the Skipper wrapper.
- **Concrete entry point:** `POST /api/admin/executive-agent/engine-runtime` → `service.ts:54` → `getExecutiveSmartTrustFulfillment(ctx)` (`executive-agent-tools.ts:497-510`, doc comment: "SMART_TRUST governed governance operations — read-only; no autonomous trust execution") → `buildExecutiveSmartTrustFulfillmentForSkipper` (`smart-trust-operations-service.ts:723-762`).
- **Existing approval boundary:** None for the read (executes on admin auth). The read only *reports* pending governance/resolution approvals. Adjacent propose-only actions exist in the same file but are **not reachable through this gateway engine**: `proposeSmartTrustGovernanceReviewFromOrder` (`:412-561`, inserts an `executiveAgentApprovals` row; "Governance review packet queued for executive approval. Internal note only — no trust execution or amendment application.") and `recordSmartTrustResolutionFromOrder` (`:569-718`, "Does not file, sign, or apply trust amendments."). The gateway cannot invoke them because `jarva.smart_trust` is `mode:"read"` (`core.ts:42` throws on propose). Side effect of the read: an audit row (`fulfillment.list_smart_trust_queue`, `actionType:"read_queue"`, `:251-259`).
- **Returned artifact(s):** Transient JSON: `{recommendationOnly:true, noAutonomousTrustExecution:true, noLegalAutomation:true, noAutonomousFiling:true, headline:"SMART_TRUST governed governance operations — owner-approved checkpoints only.", queueSummary:{total, stalledCount, pendingGovernanceCheckpoint}, stalledOrders:[≤8], focusOrder:null (via gateway), warnings:[SMART_TRUST_FULFILLMENT_SKIPPER_WARNING]}`. Queue rows carry `trustId` (from parsed `executiveHandoffJson`), `pipelineStage`, `approvalStatus`, `governanceReviewApproved`, `trusteeWorkflowLabel`, `stalledDays`. No trust document, filing, signature, or certificate produced.
- **Storage destination:** Reads `clientServiceOrders` and `executiveAgentApprovals` (TiDB/MySQL). Audit write via `auditFulfillmentExecutiveAction`. No other write.
- **Job/receipt format:** None for the read. Only the `read_queue` audit entry (count only).
- **Dependencies:** Internal only — Drizzle/MySQL plus `smart-trust-compliance-intelligence`, `smart-trust-fulfillment-handoff`, `smart-trust-governance-workflow`, `smart-trust-review-checkpoints`, `smart-trust-resolution-tracking`, `fulfillment-audit`. No external legal/filing provider, no desktop agent, no paid service evidenced in the read path.
- **Does it do legal execution, trust drafting, or desktop-readiness certification? No — status summary only.** The file's own guard constant (`:70-71`): "Skipper: Smart Trust governance is advisory only. No trust execution, legal automation, amendment application, filing, or signatures without human owner approval." The words `desktop`, `certif`, and `readiness` do not appear in the file (only the pipeline-stage constant `DRAFTING_STAGE = "service_drafting"` at `:67`, a stage label, not a drafting action). `buildGovernanceReviewPacketMarkdown` exists as a helper for the separate propose path, not the gateway read, and its output is a markdown packet queued for approval — not an executed trust instrument.
- **Missing acceptance proof:** (a) No live-DB execution evidenced. (b) No verification of what populates `executiveHandoffJson.trustId` / `governanceReviewApprovedAt` (handoff provenance untraced). (c) No desktop-readiness or legal-execution capability exists to verify — those would be separate builds.
- **Classification:** Callable server engine — yes (real server-side status aggregation). Browser-only — no. Provider readiness — no. Live execution evidence — none.

## 9. Avatar Studio — NOT in the catalog

Three layers, none of which generates an avatar server-side.

1. **Studio (browser-only 3D creator):** `src/app/avatars/page.tsx` renders `AvatarLibraryStudio` + `AvatarManager`. `AvatarLibraryStudio.tsx` dynamically imports `@/lib/avatar-library/src/AvatarCreator.js` (Three.js, client-only, WebGL). Its own copy says: "Customize body, face, and wardrobe. Use Save in the viewport to download JSON." No fetch, no server call, no GLB/image produced server-side. `src/lib/avatar-library/README.md`: "130+ unique 3D assets, all procedurally generated with Three.js geometry — no external model files needed… no external API required." 6 body shapes, 16 preset skin tones + custom hex, 12 hairstyles, hats/eyewear/jewellery/clothing. **GOLD / Dawn / Neon skins were not found** in the avatar library, presets, or studio files read — those names do not appear in this repo's avatar code (they are mobile-app skin names, not evidenced here).
2. **Preset picker (the actual save path):** `src/components/avatars/AvatarCreator.tsx` — picks one of 6 presets from `src/lib/avatars/avatar-presets.ts` (`business-male-01`, `business-female-01`, `creator-01/02`, `casual-01/02`, each a static `/models/avatars/<…>/avatar-*.glb` URL + a `via.placeholder.com` thumbnail; fallback guest avatar `/models/avatars/guest/default-avatar.glb`) and `POST /api/avatars` with `{ displayName, avatarModelUrl: preset URL, thumbnailUrl, configJson: { presetId }, sourceType: "preset", isDefault: true }`.
3. **Server CRUD (stores references, generates nothing):** `POST /api/avatars` (`src/app/api/avatars/route.ts`): `getAuthedUserId()` (401 if null); requires non-empty `avatarModelUrl`; inserts `avatarProfiles` `{ id, userId, displayName, avatarModelUrl, thumbnailUrl, configJson (JSON string), sourceType: preset|uploaded|generated, version: 1, isDefault, status: "ready" }`. Note: `sourceType: "generated"` is accepted as a label, but **no generation code path exists** — the server never creates a model or image. `GET /api/avatars/me` lists the caller's rows. `GET` + `PATCH /api/avatars/[avatarId]` are owner-scoped (`avatarProfiles.userId === userId`, 404 otherwise); PATCH updates `displayName`, `avatarModelUrl`, `thumbnailUrl`, `configJson`, `status` (`draft|ready`), `isDefault`. **This is the member image-saving PATCH: avatar/banner images are saved as URL strings (`avatarModelUrl`/`thumbnailUrl`) on the caller's own `avatarProfiles` row — no file upload, no binary storage.** Page-level access check in `src/app/avatars/page.tsx` is client-side only; the API routes themselves enforce auth.

- **Input schema:** POST body `{ displayName?, avatarModelUrl (required string ≤512), thumbnailUrl?, configJson?, sourceType?: preset|uploaded|generated, isDefault? }`. PATCH: same fields optional, `status` restricted to `draft|ready`. No zod schema; ad-hoc checks. Studio customisation has no server schema at all (JSON download only).
- **Authenticated owner/client mapping:** `getAuthedUserId()` on all avatar routes; rows keyed by `userId`; PATCH/GET-by-id enforce `userId` match. Owner = authenticated user.
- **Existing approval boundary:** **None.** Direct execution after auth+ownership. No approval row, no `validateApprovalGate`, no propose-only path.
- **Returned artifact(s):** **No generated artifact.** Studio Save = client JSON download (design config). Server returns `{ success: true, id, message: "Avatar created" }` / `{ success: true, message: "Avatar updated" }` — a DB row referencing a pre-existing preset GLB URL. No GLB/image is produced by any code read.
- **Storage destination:** `avatarProfiles` table (model URL, thumbnail URL, `configJson`). Avatar GLBs are static files under `public/models/avatars/` (referenced, not generated).
- **Job/receipt format:** None — no job, receipt, or audit entry.
- **Dependencies:** Three.js (`three`, `@react-three/drei/fiber`), `src/lib/avatar-library` (vendored procedural creator), Drizzle/`getDb`. No external provider, no paid service.
- **Missing acceptance proof:** (1) Any actual generation pipeline — today "generated" is only a label; a Skipper-callable avatar engine would need a defined generator (procedural export to GLB/image, or a provider) plus a storage destination for the output file; (2) wiring the Studio's JSON Save to `POST /api/avatars` (currently disconnected — Studio downloads JSON, preset picker is the only save path); (3) GOLD/Dawn/Neon skins do not exist in this repo's avatar code.
- **Classification:** Browser-only — **yes** for creation/customisation. Callable server engine — only in the CRUD sense (store/reference a preset URL); it is not a generation engine. Provider readiness — n/a. Live execution evidence — none for avatar generation (none exists).

## 10. World building (troo-town / green-terrain) — NOT in the catalog

A client-side 3D editor + viewer over DB-stored placements. No server-side build step.

- **Editor page:** `src/app/green-terrain/page.tsx` (2,577 lines, client). Loads placements with `GET /api/troo-world/placements?worldId=default` (line 1443); `currentWorldId` defaults to `"green-terrain"`. Renders towers (Nexus/Meridian/TrooTHERTZ/Stadium Elyseum/Veritas) and placed objects via react-three-fiber; undo/redo, trees, plains all client state. Editor sidebar: `src/components/green-terrain/WorldManagementUI.tsx` (1,055 lines). `OBJECT_LIBRARY` (line 56): Nexus Corporate Tower, Meridian Tower, TrooTHERTZ Tower, Stadium Elyseum, Veritas School + env objects. **New GLBs are registered in code** — there is no generic upload-a-GLB flow. Save does: `PUT /api/admin/troo-world/placements` `{ worldId, placements, replace: true }` (lines 416–423) then `PUT /api/admin/troo-world/elements` for trees/plains; also `POST /api/admin/troo-world/worlds` to create a world (line 499).
- **Public read:** `GET /api/troo-world/placements` (GET-only in that file). No auth. Seeds the `default` world and the `green-terrain` world record on first read; if `green-terrain` is empty it copies placements from `default` once. Returns `{ worldId, worldName, placements: [{ id, elementKey, glbUrl, posX/Y/Z, scale, rotY }] }`. Public view: `src/app/troo-town/page.tsx` — public view for worldId `green-terrain`.
- **Write route:** `PUT /api/admin/troo-world/placements` (178 lines). `requireAdminOrAuth` (lines 14–22): accepts `admin-token` **or any valid `auth-token`** — "Admin or any authenticated user can save (green-terrain editor uses auth-token)". **Any authenticated user can overwrite placements for any `worldId`, including the public `green-terrain` world; there is no owner check, no per-world permission, and no approval boundary.** Upserts each placement into `trooWorldPlacements`; with `replace:true` it deletes placements (and their meeting-node placements/invites) not in the new list. Returns `{ success: true, message: "Placements saved" }`.
- **Separate worlds system:** `src/app/api/worlds/route.ts` — `GET` lists public/unlisted worlds (or the caller's own if authenticated), `POST` creates a row in the `worlds` table with `visibility` (public/unlisted/private), `terrainSeed`, `biomeType`. This is the Phase-3 visibility system; it is distinct from the `trooWorldPlacements` editor above. No approval boundary evidenced there either.
- **Input schema:** PUT body `{ worldId?, replace?, placements: [{ elementKey, glbUrl, posX, posY, posZ, scale?, rotY? }] }` — validated only as "placements must be an array". No zod schema; `glbUrl` is `String(p.glbUrl ?? "")` with no allowlist (any string accepted, including arbitrary URLs). Elements PUT: `{ worldId, elements: [{ type: tree|plain, posX/Y/Z, rotY, scale, colorHex, label, isDefault }] }`.
- **Authenticated owner/client mapping:** PUT: valid JWT in `admin-token` or `auth-token` cookie (`verifyToken`); **any authenticated user, not admin-only; no owner/world mapping**. Public GET: no auth.
- **Existing approval boundary:** **None.** No approval row, no `validateApprovalGate`, no propose-only path, no visibility/publish gate on the placements PUT — saving *is* publishing to the public `/troo-town` view. (The separate `/api/worlds` system has a `visibility` column, but the troo-world placements path does not consult it.)
- **Returned artifact(s):** A saved scene: `trooWorldPlacements` rows (+ `trooWorldElements` trees/plains). Returns `{ success: true, message: "Placements saved" }`. No built file, no GLB output, no render.
- **Storage destination:** TiDB/MySQL via Drizzle: `trooWorlds` + `trooWorldPlacements` (+ `trooWorldElements`, meeting-node tables). GLB assets are static files under `public/models/`. Placement `glbUrl` values are either `/models/…/*.glb` paths or `procedural:<name>` tokens rendered by hardcoded components.
- **Job/receipt format:** None — no job, receipt, or audit entry; only the PUT response and console logs.
- **Dependencies:** `three` / `@react-three/fiber` / `@react-three/drei` (client rendering), Drizzle + TiDB (`getDb`), `verifyToken` auth. No external provider, no paid service, no build pipeline.
- **Missing acceptance proof:** (1) An approval/ownership boundary on the placements PUT before any Skipper invocation (today any signed-in user can overwrite the public world); (2) a `glbUrl` allowlist/validation (today any string is stored and later loaded by the viewer); (3) any server-side build/validation step — currently client-side placement only, with GLBs registered in code; (4) live execution evidence was not run here (read-only audit).
- **Classification:** Callable server engine for persistence — **yes** (GET + PUT placements are real, working routes). Browser-only for building — **yes**; all placement/building happens client-side; there is no server-side build step. Provider readiness — n/a. Live execution evidence — not verified in this read-only pass. **Not approval-gated; not production-ready as a Skipper-called engine** without (1)–(3).

## 11. REN (image analysis) — NOT in the catalog

**Repo + ref:** `HGanR/skipper`. REN pipeline work lives in draft PRs, **not** on the default branch. Chain (all draft, open, unmerged — verified): PR #40 (head `2537a2113dde`) → PR #41 (head `30f826d42d23`) → PR #42 (head `9d5f7c215367`) → PR #43 (head `e784abbe9d12`) → PR #44 (head `7fc16b77ab06`). Latest REN/TAYO state is PR #44 head `7fc16b77ab06`. REN files (existence verified from the PR #41 file list; line-level content **not** re-read in this task due to the rate limit): `ren_architecture.py`, `ren_building_spec.py`, `ren_facade_landmarks.py`. PR #42 added `scripts/audit_ren_caption_handoff.py` and the reconstruction-quality audit doc. PR #43 added `blueprints/white-modern-building-v1.json` (the reviewed blueprint), `scripts/validate_blueprint.py`, `tests/test_architectural_blueprint.py`.

- **What it is (prior verified record):** REN is the image-analysis agent. Images become `renBrief`s for TAYO behind a handoff gate. The 2026-10-18/19 diagnosis found: REN routing is silent (no acknowledgment as described), the reference-image gate is closed, and the pipeline stops at "brief received." **No image-to-3D inference engine exists anywhere in the platform.** The in-house local path (Option A, picked 2026-10-30) is: moondream:1.8b via local Ollama → reviewed blueprint → deterministic Blender (geometric) / TripoSR local CPU (organic) → Blender headless post-worker → shared asset library via the TAYO registry.
- **Input schema:** A reference image (single image per project; the backend explicitly rejects multiple reference images — "Use one reference image per project") or a typed species name (for trees). REN analysis produces a caption/brief. (Prior verified record; exact input schema file/line not re-read.)
- **Authenticated owner/client mapping:** Not evidenced in this task. REN runs locally (isolated CPU provider `/Volumes/REN-CPU-Test`, venv `/Volumes/REN-CPU-Test/venv/bin/python`); no website-side authenticated owner/client mapping.
- **Concrete entry point:** The paired run goes through **Studio** (restart Coding Agent, reconnect the paired Desktop, upload one building reference, request Step 2) — not a direct command, because `ren_local_worker.py` is a library, not a script. Step 1a is a Mac verification; Step 1b activates with `/Volumes/REN-CPU-Test/venv/bin/python scripts/configure_ren_local.py --activate`. (Prior verified record.)
- **Existing approval boundary:** The **reviewed-blueprint gate** — a human (Charles) reviews the architectural blueprint before TAYO builds from it (PR #43's blueprint was reviewed by Charles with no corrections). Vision-model-authored specs are explicitly forbidden — only deterministic Blender builders consume the reviewed geometry spec; no model-returned text is ever executed. **No** website approval-row path for REN.
- **Returned artifact(s):** A `renBrief` / caption and (after review) an architectural blueprint JSON (`blueprints/white-modern-building-v1.json`). No GLB — REN does not produce geometry. (Prior verified record.)
- **Storage destination:** Blueprint and evidence in the skipper repo under `blueprints/` and `docs/evidence/`. REN worker and venv on the isolated CPU provider. Asset-project records in `~/.skipper/troo-country/asset-projects/` (reference-hash discrepancy `3e98e116…` vs `d6ef31b1…` remains open).
- **Job/receipt format:** Not evidenced in this task. No website-side job record or approval-row receipt. REN routing is silent (no acknowledgment), itself an open diagnosis item.
- **Dependencies:** moondream:1.8b via local Ollama, TripoSR local CPU (organic assets), Blender (headless post-worker). All local/in-house; no GPU instance, no external VLM or 3D APIs, no paid spend (Option A).
- **Missing acceptance proof:** (1) No image-to-3D inference engine exists (audit 2026-10-18). (2) REN routing is silent and the reference-image gate is closed — live pipeline stops at "brief received." (3) No website invocation path. (4) Reference-hash discrepancy open, not re-bound.
- **Classification:** Browser-only — no. Callable server engine — partial (local REN worker exists and runs, Step 1a/1b/1c), but **not** callable from the website server/gateway, and the live pipeline stops at "brief received." Provider readiness — partial (moondream via local Ollama is the in-house path; no external VLM wired; no image-to-3D inference engine). Live execution evidence — partial (local analysis runs exist; end-to-end live pipeline image → brief → reviewed blueprint → built model has not been demonstrated live; paired Studio run Step 1c is the next evidence step).

## 12. TAYO (3D modeler) — NOT in the catalog

**Repo + ref:** `HGanR/skipper`, latest REN/TAYO state PR #44 head `7fc16b77ab06` (draft, open, unmerged). TAYO is scoped (2026-10-21) as **modeler only** (geometry + materials); rigging/animation is reserved for a separate agent Charles will name. Files (existence verified from the PR #44 file list; line-level content **not** re-read due to the rate limit): `tayo_blueprint_layout.py` (530 lines, the Blender consumer), `scripts/tayo_blueprint_recipe.py`, `docs/BLUEPRINT-CONSUMER-20261030.md`, `docs/evidence/blueprint-v1/geometry-report.json`, `tests/test_tayo_blueprint_layout.py`. PR #41's evidence-gated accessories are in `ren_architecture.py` / `ren_building_spec.py` / `ren_facade_landmarks.py` and `tests/test_ren_evidence_gated_accessories.py`.

- **What it is (prior verified record):** TAYO is the 3D-modeler agent (geometry + materials). It consumes **only** the reviewed architectural blueprint (PR #43, reviewed by Charles with no corrections) through deterministic Blender builders. Final output must match, or come close to, the reference's texture, topology, colors, and shapes, and buildings must be **enterable** (hollow ground floor, blank-canvas interior, real doorway). PR #41 delivered evidence-gated balconies and exterior access (three fix rounds, 19/19 spec tests, real Blender 4.2.0). PR #44 v2: 199 parts, GLB 293,184 B, layout tests 10/10.
- **Input schema:** The reviewed architectural blueprint JSON (`blueprints/white-modern-building-v1.json`, PR #43) plus the geometry spec it carries. TAYO does **not** accept a raw image or a vision-model-authored spec. (Prior verified record.)
- **Authenticated owner/client mapping:** Not evidenced in this task. TAYO runs locally via Blender headless; no website-side authenticated owner/client mapping.
- **Concrete entry point:** Deterministic Blender builder `tayo_blueprint_layout.py` (PR #44 head `7fc16b77ab06`), driven by `scripts/tayo_blueprint_recipe.py`, run headless in Blender. No website route, API, or CLI exposed by the website invokes it.
- **Existing approval boundary:** The **reviewed-blueprint gate** — only the blueprint Charles reviewed may be consumed. Vision-model-authored specs are explicitly forbidden. **Evidence gating** (PR #41): balcony and exterior-access geometry is generated only where per-level facade evidence supports it. **No** website approval-row path for TAYO.
- **Returned artifact(s):** A GLB model (PR #44 v2: 293,184 B) plus a geometry report (`docs/evidence/blueprint-v1/geometry-report.json`) and render evidence. Enterable building (hollow ground floor, real doorway, blank-canvas interior). (Prior verified record.)
- **Storage destination:** GLB and geometry report in the skipper repo / local working tree. The shared asset library (TAYO holds the registry; mobile and website share one library) is the intended destination, but the GLB-to-library publication step is **not** evidenced as implemented in this task.
- **Job/receipt format:** Layout tests (`tests/test_tayo_blueprint_layout.py`, 10/10 in PR #44 v2) and the geometry report JSON serve as the build receipt. No website-side job record or approval-row receipt.
- **Dependencies:** Blender (headless, 4.2.0 in the PR #41 evidence), Python (layout builder), the reviewed blueprint JSON. Local CPU only; no GPU instance, no external 3D APIs, no paid spend.
- **Missing acceptance proof:** (1) PR #44 v2 has open gaps Charles has not yet ruled on (thin/partly hidden arch, unlit entrance passage / black void, white-on-white rooftop room, camera 30° vs 22°). Do **not** build v3 without his correction. (2) No website invocation path and no publication step into the shared asset library evidenced. (3) PRs #41–#44 are all draft and unmerged. (4) Multi-view intake is scoped but not built; the backend rejects multiple reference images.
- **Classification:** Browser-only — no. Callable server engine — partial (deterministic Blender consumer exists and runs locally with render evidence), but **not** callable from the website server/gateway. Provider readiness — yes for the local Blender path. Live execution evidence — yes for local Blender builds; **none** for website-triggered or served execution.

## Can the website gateway (PR #21) invoke the Coding Agent or REN/TAYO today?

**No — for all three.** The code establishes this three ways (all verified):

1. **The catalog has no adapter for them.** The 13 adapters cover only website-internal agents (skipper, bentley, stephon, eleanor, jarva, reality). There is no `coding_agent`, `ren`, or `tayo` engine ID, and `writeActionForEngine` throws ("This engine does not accept execution proposals.") for any ID outside the three approval-mode engines.
2. **The route says so explicitly.** The GET handler returns the limit: "REN/TAYO modeling and native Coding Agent run through their separately governed local adapters." The gateway therefore does not claim them.
3. **Their only reachable paths are local/paired, not website.** The Coding Agent is reachable via the paired Desktop / Studio / direct local CLI on the paired Mac. REN is reachable via the Studio paired run (Step 1c) and local invocation on the isolated CPU provider. TAYO is reachable via local Blender headless runs. None of these paths goes through the website gateway, and none is governed by the website approval rows.

Any future website-triggered invocation of them would need a new adapter, a new approval boundary, and the open questions resolved first (notably: the Coding Agent's MCP-client capability for GitNexus, and the REN pipeline's silent routing / closed reference-image gate).

## Cross-cutting findings

1. **The catalog is a routing surface, not proof of engines.** Of the 13 registered adapters, 10 are reads and 3 are approval-gated actions. Of the engines inventoried here, 4 are callable server reads (Inbox, Bentley outputs, Eleanor, Jarva), 2 are callable server actions (Bentley market research, Bentley campaign drafts), 1 is a callable read + a note-writing action (Stephon), and 4 are **not in the catalog at all** (QR Maker, Seal Maker, Avatar Studio, world building) — they exist as browser UI plus thin persistence CRUD. The Coding Agent, REN, and TAYO are callable locally, not via the gateway.
2. **No engine in this inventory has live execution evidence.** Every finding is a static code read. The gateway integration test proves routing/gating with fixtures, not that any real engine runs.
3. **Reads bypass approval by design** (`engine-runtime-core.ts:38-41`). That is consistent with their read-only mode, but note the asymmetry: the two fulfillment reads still perform DB **writes** (audit rows), while the Inbox read does not. And the Inbox read is admin-global with no owner/client scoping, while Eleanor and Jarva are owner-scoped — worth confirming as intended policy.
4. **No money, no law, no desktop in any read path:** no ledger/invoice/amount fields, no payment provider, no trust execution/filing/signing, no desktop-readiness check — all confirmed by absence in the cited files, not by inference. `skipper.knowledge` is a hardcoded placeholder ("Knowledge base integration is not wired").
5. **Receipts don't exist for reads:** any downstream consumer expecting a durable job/receipt for a read engine will find nothing — `engineReceipt` 404s without an approval row. For the three approval actions, the receipt is the approval row + the `approval_execute` audit entry; the code itself warns that an "approved" receipt means "Execution was claimed; a final receipt is not yet confirmed."
6. **Two routes need attention regardless of Skipper** (security-relevant, found during this inventory):
   - `POST /api/certificates` — **unauthenticated**, stores arbitrary caller-supplied data-URLs under any caller-supplied wallet address into `dashboard_certificates`.
   - `PUT /api/admin/troo-world/placements` — **any authenticated user** can overwrite placements for any `worldId`, including the public `green-terrain` world; no owner check, no approval boundary; `glbUrl` is stored without an allowlist.
7. **Two build-correctness flags:** `qrcode` is imported by `src/app/qr-maker/page.tsx` but absent from `package.json` (needs a clean-build check); the Seal Maker's SVG export is advertised in UI state but unimplemented (alerts "Please use PNG format").

## Gaps / not verified (must be closed before treating findings as repo-wide fact)

- `src/lib/revenue-os/market-sweep-synthesize.ts` (LLM provider/model/key/cost) and `src/lib/revenue-os/market-signals/aggregateRealSignals.ts` (whether the Reddit fetch is a live authenticated call) — both unread (429). The "LLM-emulated with mock fallback" finding is therefore **fallback-structure confirmed, provider/reality unconfirmed**.
- `src/lib/revenue-os/bentley-sync-launch-server.ts` (campaign-sync internals) — unread. The no-publish guarantee for `bentley.campaign_drafts` is **executor-level only**.
- `src/lib/executive-agent/executive-action-payloads.ts` (executor-side zod schemas) — unread; the Stephon schema-superset discrepancy was verified from a head excerpt only.
- `src/app/api/site-builder/*` route handlers — six read in full for the Stephon spec (§2c): `sites`, `builder-actions`, `draft-apply`, `export`, `sites/[siteId]/deploy`, `assistant/execute-intent`. **CORRECTED 2026-11-03:** the brief→schema entry point exists at `src/pages/api/site-builder/ai/pipeline.ts` (step `full`) — the remaining Stephon gap is now the adapter's own work (ownership validation, version persistence, private preview/receipt, fallback and generic-content handling), not the existence of a generator. Still unread: `ai/intelligence/*`, `sites/[siteId]/versions/*`, `sites/[siteId]/action-runs/*`, the `executeBuilderActions` action catalogue, `src/lib/site-builder/intelligence/*`, plus `assets/*`, `assistant/npc-sync`, `deliverables`, `import/*`, `templates/*`, and supporting lib code.
- `src/lib/executive-agent/executive-inbox-site-project.ts` — unread.
- Full `web3Sites` schema + status enum; `linkSiteBuilderDraftToFulfillmentDeliverable` body; `clientNotes` schema beyond the inserted fields; what writes `bentleyGenerationJson`; what writes `paymentConfirmations.status`; which client (if any) posts to `/api/certificates`; the consumer of stored QR URLs in `trustAssets`.
- No live execution evidence for any engine (no test run, no live DB read, no gateway call in this inventory). The `validateApprovalGate` step inside the canonical approve handler was not re-read in this pass (it was verified in the earlier STEP 0 audit at PR #15).

## Bottom line

The PR #21 integration doc's statement stands: **"No website builder, QR renderer, seal renderer or world/avatar production adapter is claimed added."** What exists today is: a gateway that routes 13 registered adapters (10 reads, 3 approval-gated actions) through the audited approval handlers; real server reads for Inbox, Bentley outputs, fulfillment, and Smart Trust; two real approval-gated writers (Bentley market sweep — whose result evaporates except for three counts — and Bentley campaign drafts — whose sync internals are unread); a Stephon intake that writes a brief note and nothing else; and four capabilities (QR, seal, avatar, world) that exist as **browser UI plus thin persistence CRUD**, with no server-side production engine, no input schema, no approval boundary, no job/receipt format, and no generated artifact. The two adapter specifications are therefore **builds on top of existing engines and persistence**: QR is a new server engine (no server render exists); Stephon **reuses both halves** — the existing brief→schema pipeline (`src/pages/api/site-builder/ai/pipeline.ts`, step `full`, found 2026-11-03) and the existing deploy path for the second half (schema → static bundle → Pinata → public gateway URL) — with ownership validation, version persistence, a preview-only variant, and approval gating added, since raw deploy publishes publicly on a single owner call. **A public IPFS deployment is publication, not a private preview.** The adapter still needs: ownership validation before provider use, saved-version persistence, and a private preview with receipts. These findings come from source inspection; live generation remains unverified. Both specs must first close the gaps listed above (for Stephon, the adapter's ownership/persistence/preview work plus the remaining supporting inventory; for QR, the `qrcode` dependency, a decode test, and server-side URL validation).

> **CORRECTION (2026-11-03, PR #23):** the brief→schema first half EXISTS at `src/pages/api/site-builder/ai/pipeline.ts` (see Stephon spec correction banner). The adapter reuses it; it does not build a duplicate.
