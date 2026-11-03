# Adapter Specification — Stephon Actual Website Generation — DRAFT

> **CORRECTION (2026-11-03, PR #23 preflight finding — supersedes the "no brief→schema endpoint" conclusion below):** an existing brief→schema pipeline was found at `src/pages/api/site-builder/ai/pipeline.ts` (735 lines, at PR #22 head `c8e29c32`) — a `src/pages/api/` tree this inventory never read; the "not found" statement was scoped to the `src/app/api/site-builder/*` routes read. POST-only, session-auth, `PipelineRequestSchema`, steps `plan`/`full`/`generate`; `full` runs `runSitePlanner` → `generateSiteSchemaFromPlanner` with content intelligence/critique, evaluation, and generation-intelligence persistence, returning schema, alternates, `generationMeta`, `intelligenceRunId`. **The adapter must REUSE/extract this service, not build a duplicate first half.** Still needed: client/site ownership validation before provider use, persisting the generated version, a private preview/receipt without the public IPFS deploy path, and explicit handling of global-provider fallback + deterministic/generic-content warnings. No pipeline/provider invoked, no adapter registered, no runtime generation or quality acceptance claimed.


**Date:** 2026-11-03
**Repo:** `HGanR/hero-factory-marketplace-hero-market`
**Base head:** PR #21 `0db3b8c58e3d7414603f4439e1a3ca1e1e2adbcf`
(branch `feat/skipper-audited-engine-integration-20261103`)
**Status:** Specification only. No code, schema, approval-gate, deployment, or
provider change. No paid provider is introduced. Codex owns executable
implementation after review, within Charles's authorized scope.
**Work package:** `docs/SKIPPER-MUSE-PARALLEL-WORK-20261103.md` (in PR #21).

## 1. Goal

An authenticated paired SKIPPER should be able to take an owned client's
approved website brief, generate an actual website from it, test it, and
deliver a preview URL — with the generated files, the test result, and the
preview receipt linked to the selected client — instead of today's gateway
path, which records the brief as an internal note and generates nothing.

A catalog entry, an intake note, a review document, or an approval is not a
completed product. The adapter is done only when generated files exist,
a preview URL resolves, and the receipt links them to the client.

## 2. What exists today (evidenced)

### 2a. Gateway chain — brief only, no generation (proven)

`stephon.intake` maps to executor action `createSiteBuilderTask`, whose
entire effect is one `INSERT` into `clientNotes` with the literal footer
`(No live site schema mutation from this action.)` and the return message
`"Site Builder task captured as internal note (intake only)."` No file
write, no HTML generation, no build, no publish, and no preview URL exist
anywhere in the contract → executor chain. The read side
(`stephon.projects`) is a bounded `SELECT` of existing `web3Sites` rows.

- **`stephon.projects` (read) — `getSiteBuilderProjectStatus`
  (`executive-agent-tools.ts:268-284`):** Input `z.object({}).strict()` —
  no input fields; client scoping comes from server-side context
  (`selectedClientId`), not the request body. Selects
  `{id, name, status, updatedAt}` from `web3Sites` where
  `web3Sites.clientId = cid`, `ORDER BY updatedAt DESC LIMIT 20`; returns
  `{clientId, sites}` or `{sites: [], message: "No client id."}`. The
  gateway's `ownedInput` check only fires when `clientId`/`campaignId` is
  present in request input, which never happens for this read — so the
  read's ownership enforcement is the gateway's admin-JWT gate plus
  whatever sets `selectedClientId`, not a per-client check in the tool
  itself. Full `web3Sites` schema (all columns, status enum/allowed
  values, any URL/preview/file columns) was **not read** — status values
  are not evidenced; `status` is returned as an opaque value.
- **`stephon.intake` (approval → `createSiteBuilderTask`):** Input
  `{ clientId: UUID, title: string (trim, 1–500), instruction: string
  (trim, 1–20000) }`, strict. Catalog purpose: "Record an owned client's
  website brief as an internal intake note. This does NOT build a
  website." Executor-side schema is a **superset** — it adds
  `pageSlug: z.string().trim().max(191).optional().nullable()` and
  `priority: z.enum(["low","normal","high"]).optional().default("normal")`.
  Since `writeActionForEngine` passes only the contract-validated
  `{clientId, title, instruction}`, a gateway-proposed intake can **never**
  carry `pageSlug` or `priority` (they silently default); only a direct
  executor caller could set them. Entry:
  `runCreateSiteBuilderTask(ctx, raw)` —
  `src/lib/executive-agent/executive-action-executors.ts:700-734`;
  registered in `EXECUTIVE_ACTION_EXECUTORS` as `createSiteBuilderTask`
  at `:811`. `assertClientOwnedByAdmin(db, clientId, adminUserId)` before
  any insert. Complete effect: a single `clientNotes` insert
  (`visibility: "internal"`, author = approving admin), returning
  `{ok:true, status:"executed", message:"Site Builder task captured as
  internal note (intake only).", data:{clientId, clientNoteId}}`. No
  `web3Sites` insert/update, no task/queue row, no file, no HTML, no
  build invocation, no publish call, no preview URL. The name
  `createSiteBuilderTask` is misleading — no task entity exists; the
  "task" is the note. Post-execution hook (call site only): on success
  with a `clientNoteId`, `dispatchPersistedExecutiveAction` calls
  `linkSiteBuilderDraftToFulfillmentDeliverable(db, {adminUserId,
  approvalId, clientNoteId, payload})`
  (`executive-action-executors.ts:924-935`; imported from
  `@/lib/fulfillment/fulfillment-deliverable-draft`). The linked
  function's body was **not read** — what it creates is not evidenced
  beyond the call site and argument names. It is downstream bookkeeping
  on the note, not generation.
- **Approval boundary (today, for the note only):** propose-only,
  approval-gated. Execution re-reads the persisted row via
  `lockExecutiveApprovalForExecution`, refuses unless `status ===
  "approved"`, dispatches from the persisted row's `proposedAction`/
  `payloadJson` (not caller-supplied values). Audit entry per execution
  via `auditExecutor` → `insertExecutiveAgentAuditLog`
  (`toolName: "executor.createSiteBuilderTask"`,
  `actionType: "approval_execute"`).
- **Dependencies (today):** Internal only — Drizzle/MySQL, zod, Node
  `crypto.randomUUID`, approvals store, audit, policy,
  fulfillment-deliverable-draft. **No external provider, no LLM call, no
  paid service is invoked by the intake or project-status code read.**

### 2b. Second, distinct "site builder" read surface (not `web3Sites`)

`buildStephonSiteBuilderOverview(db, {sessionLimit})` —
`src/lib/executive-agent/stephon-site-builder-service.ts:105-231`. This is
**not** `web3Sites`: it resolves the Stephon NPC and reads OASIS
conversation tables only — `oasisNpcs` (NPC `npcId =
"site-builder-stephon"`, world `"site-builder"`, active; fallback name
`LIKE '%stephon%'`), `oasisNpcSessions` (last 30 days, limit 24–60),
`oasisNpcMessages` (latest snippet per session). It returns
`StephonSiteBuilderOverviewDto`: `{ok, generatedAt, worldId, worldLabel:
"Site Builder", engineId: "site-builder-engine", npcConfigured, npcId,
npcName, totals: {sessions30d, messages30d, activeSessions}, sessions,
skipperBrief, usabilityThemes, meta: {readOnly: true, piiMasked: true,
skipperCanAccessTranscripts: true}}`. Constants:
`SITE_BUILDER_ENGINE_ID = "site-builder-engine"`, with the comment
`/** Platform desk scope — not a 3D world building. */`. **No `web3Sites`
row, file, or generated artifact is touched here** — "project status" in
this service means "what operators discussed with the Stephon NPC in the
last 30 days, with masked snippets and usability hints." A spec must not
conflate these two read models. Its caller/dispatch was not verified.
Persona copy (`src/lib/site-builder/stephon-persona.ts`): Stephon is the
"Site Builder AI Guide"; `STEPHON_GREETING` says "I'll help you plan,
generate layouts, refine copy…", while `STEPHON_SYSTEM_PROMPT` says "You
do not deploy, publish, charge, or mutate production without the user's
explicit save/deploy actions in the builder UI." Persona/marketing copy is
**not** a code path — "generate layouts" here is ungrounded until the
`site-builder/ai` handlers are read (see §2c).

### 2c. The `src/app/api/site-builder/*` tree — follow-up inventory (DONE 2026-11-03)

Inventory report:
`.../files/work/site-builder-inventory-DRAFT.md` (read-only GitHub reads
at PR #21 head; no 429 encountered; ~32 calls). Top level — exactly 10
subdirectories, no files: `ai`, `assets`, `assistant`, `builder-actions`,
`deliverables`, `draft-apply`, `export`, `import`, `sites`, `templates`.

- `ai/intelligence/` → `feedback/`, `variant-selection/` (contents not
  listed)
- `assets/` → `route.ts`, `[assetId]/route.ts`
- `assistant/` → `execute-intent/route.ts`, `npc-sync/route.ts`
- `builder-actions/`, `deliverables/`, `draft-apply/`, `export/` → each
  a single `route.ts`
- `import/` → `route.ts`, `proxy/route.ts`
- `sites/` → `route.ts`, `[siteId]/` → `route.ts` + `deploy/route.ts` +
  `action-runs/`, `agency-widget/`, `ai-settings/`, `domains/`,
  `import-runs/`, `mint/`, `versions/`, `widget-conversations/`
- `templates/` → `route.ts`, `[templateId]/route.ts`

Six handlers read in full. Verdicts:

| Handler | Verdict |
|---|---|
| `sites/route.ts` | **Does not generate** — POST creates an empty DRAFT `web3Sites` row only (`status: "DRAFT"`, `currentVersionId: null`). GET lists the caller's own sites. Auth `getAuthedUserId()` → 401; trust access `ensureTrustAccess` → 403; client ownership `getOwnedClientRow` → 403. Input `CreateSiteSchema` (fields used: `name`, `slug?`, `trustId?`, `clientId?`, `workspaceId?`, `ownerWallet?` — full schema not read). |
| `builder-actions/route.ts` | **Does not generate files** — mutates a schema document via actions. POST, auth 401; input `BuilderActionsRequestSchema` (`schemaJson`, `actions`, `siteId?`, `versionId?`, `source?`); ownership `getOwnedSite` → 404. LLM: if `siteId` present, `resolveSiteBuilderLlmInvokeForSite(db, userId, siteId)` resolves a per-site LLM invoker, passed as `invokeLlm` to `executeBuilderActions` — provider, model, and key env **not evidenced** (resolver body unread). Effect: `executeBuilderActions(...)` returns a mutated schema + per-action results + `sessionEditContext` + `abortedAt`; schema returned to the caller, not persisted here. An action-run log row is written via `insertBuilderActionRun` (table not evidenced). No HTML/files. |
| `draft-apply/route.ts` | **Does not generate** — stateless schema transform for unsaved drafts. POST, auth 401; input `{ schemaJson, actions: BuilderActionSchema[].min(1).max(48) }`. `filterDraftSafeBuilderActions` drops non-draft-safe actions; if none remain, 422: "No draft-safe actions in this request. Save a site project to use imports, full regen, or agent binding." Docstring: "Apply builder actions to a site schema **without** a saved site id and **without** audit DB rows. Used for unsaved / draft Site Builder projects (NL edits before 'Create site'). Does not run execute-intent; does not bind agents or import URLs." No DB write of any kind. **"Full regen" is explicitly a saved-site-only capability** — a brief→schema step cannot run through this route. |
| `export/route.ts` | **Generates files (no storage, no preview)** — POST, auth 401; input `{ schemaJson }` validated by `SiteSchemaDocument.safeParse` (400 on failure); no `siteId` — works on any caller-supplied schema, saved or not. `buildDeploymentProjectFromSchema(parsed.data, { userId })` produces `ProjectExportFile[]`; `zipProjectFiles` (`archiver`, level 9) packs them; response is `application/zip`, `Content-Disposition: attachment; filename="site-project.zip"`, `Cache-Control: no-store`. Files exist only in memory for the download. No bucket, no DB row, no job record, no preview URL. The builder (`site-builder-project-export`) was **not read**, so the file list (HTML/CSS/JS? framework project? static files?) is not evidenced. No bundler/Next-build invocation visible at the route layer. |
| `sites/[siteId]/deploy/route.ts` | **Generates + builds + previews — the reuse anchor.** POST, auth 401; input path `siteId`, body `{ versionId? }` (ad-hoc parse, no zod). Ownership `getOwnedSite` → 404. Target version = `versionId` or the site's `currentVersionId` (400 if neither); version row must belong to the site (404 otherwise). Stored `version.schemaJson` parsed/validated (`SiteSchemaDocument.safeParse`); `generateStaticBundle(schema)` returns `{ files: [{ path, contentType, content, bytes, sha256 }], manifest }` — a real static site bundle generated from the schema. The static generator body (`src/lib/site-builder/static-generator`) was **not read**. The whole bundle is uploaded as one JSON payload via `uploadArbitraryJSONToIPFS(bundlePayload)` (Pinata; `upload.ipfsHash` / `upload.ipfsUrl`); payload includes `siteId`, `versionId`, `version`, `generatedAt`, `metadata`, full `files[]`, `manifest`. Storage writes: `web3SiteVersions` updated with `ipfsCid` + `buildManifestJson`; `web3Sites` updated with `currentVersionId` + `status: "PUBLISHED"`. Preview URL: `gatewayUrl = https://gateway.pinata.cloud/ipfs/${ipfsCid}`, returned with `ipfsCid`, `ipfsUri`, `manifest`. Intelligence hook: `markLatestSiteGenerationRunPublished(db, { userId, siteId, publishedVersionId, deployedUrl: gatewayUrl })` — evidence that a "site generation run" record exists in `src/lib/site-builder/intelligence/` (**not read**). **Approval boundary: NONE — a single authenticated owner call publishes the site to a public gateway URL.** External provider: Pinata IPFS (key/plan/cost not evidenced). |
| `assistant/execute-intent/route.ts` | **Does not generate** — NL intent analysis against a saved schema; returns analysis only, persists nothing. POST, auth 401; input `ExecuteIntentRequestSchema` (`message`, `siteId`, `versionId`, `schemaSnapshotHash`, `sessionId`, `editContext`). Ownership `getOwnedSite` → 404. Staleness guard: stored schema hash vs `schemaSnapshotHash` → 409 `schema_snapshot_mismatch`. LLM via `resolveSiteBuilderLlmInvokeForSite` + `runExecuteIntentAnalysis` — whether it returns proposed builder actions vs. only prose is **not evidenced** at the route layer (function body unread). |

**Single most important finding (CORRECTED 2026-11-03, PR #23 preflight finding): both halves of the generation path already exist and are reusable — the brief → schema first half was found outside the six-handler inventory, at `src/pages/api/site-builder/ai/pipeline.ts` (735 lines, at PR #22 head `c8e29c32`; a `src/pages/api/` tree this inventory never read).** The deploy route does the second half: saved version schema → static bundle → IPFS upload → public gateway URL. Export proves the same schema→files step works without a saved site (ZIP instead of a URL). The first half: `pipeline.ts` is POST-only, session-authenticated (`marketplaceUserIdFromSessionCookiePair`), validated by `PipelineRequestSchema`, with steps `plan` / `full` / `generate` (plus evaluation and section regeneration); `full` runs `runSitePlanner` → `generateSiteSchemaFromPlanner` with content intelligence/critique, evaluation, and generation-intelligence persistence (`recordSiteGenerationFullRun`), returning schema, optional alternates, `generationMeta`, and `intelligenceRunId`. Its provider resolver (`resolveSiteBuilderLlmInvokeForSite`) and generator are existing modules. **The adapter reuses/extracts this service; it does not build a duplicate first half.** The earlier "not found" statement below was scoped to the six `src/app/api/site-builder/*` handlers read, and is retained as that inventory's record — it is not a repo-wide claim.

**Remaining gaps (still open, in priority order):** ownership validation before provider use (the pipeline authenticates a user, it does not check that the user owns the selected client/site — the adapter must add that); persisting the generated version (the pipeline returns a schema; the adapter must save it as a `web3SiteVersions` row); a private preview with receipts (see §3.3 step 5 — the deploy route's public IPFS URL is publication, not a private preview); and explicit handling of the global-provider fallback and deterministic/generic-content warnings surfaced in `generationMeta` (`llmUsed`, `fallbackReason`, `genericContentWarning`, `plannerPath`). Also still unread: `ai/intelligence/*`, `sites/[siteId]/versions/*`, `sites/[siteId]/action-runs/*`, the `executeBuilderActions` action catalogue, `assets/*`, `assistant/npc-sync`, `deliverables`, `import/*`, `templates/*`, and supporting lib code (`static-generator`, `site-builder-project-export`, `provider-resolver` body, `intelligence/`, full `web3Sites`/`web3SiteVersions` schemas, `uploadArbitraryJSONToIPFS` / Pinata). **No live execution evidence for any handler or for the pipeline itself — these findings come from source inspection only; live generation remains unverified.**

**Two requirements settled by this inventory regardless of the gap:**
(a) **approval gating must be added by the adapter** — none of the six
handlers has any approval boundary; deploy in particular publishes to a
public URL on a single owner call, so a Skipper-called adapter must not
expose raw deploy; (b) **the preview-URL contract is fixed** —
`gatewayUrl = https://gateway.pinata.cloud/ipfs/<cid>`, with `ipfsCid` +
`buildManifestJson` stored on `web3SiteVersions` and `status:
"PUBLISHED"` on `web3Sites` — **but see §3.5: deploy conflates preview
and publish, so the adapter must add a preview-only path rather than
calling raw deploy for a preview.**

Cross-cutting (tree): auth pattern everywhere is `getAuthedUserId()` →
401, ownership via `getOwnedSite` / `getOwnedClientRow` /
`ensureTrustAccess` → 403/404; no handler consults an approval row or
`validateApprovalGate`. Client linkage: `web3Sites.userId` (owner) +
optional `clientId` / `trustId` / `workspaceId`; versions keyed by
`siteId` (`web3SiteVersions.siteId`). No evidenced link from a
site/version to a generated-file host other than the Pinata CID. No
handler takes a free-text brief, intake note, or `clientNoteId` — the
Stephon intake note (`clientNotes`) has **no evidenced consumer in this
tree**. "Build" here means deterministic static-file generation from a
JSON schema (`generateStaticBundle` / `buildDeploymentProjectFromSchema`);
nothing in the read handlers runs a bundler/Next build.

### 2d. Current build/preview storage (what exists today)

- **Generated files:** none evidenced in the gateway chain. No `public/`
  write, no bucket, no external host referenced by the contract, executor,
  tools, or Stephon service files read.
- **Tests:** none evidenced for the gateway Stephon path in this session.
- **Preview receipts:** none — no preview URL is produced or stored by
  `stephon.projects` (returns only `web3Sites` id/name/status/updatedAt)
  or by `stephon.intake` (returns only `{clientId, clientNoteId}`).
- **What does exist as storage:** `clientNotes` (the brief,
  `visibility: "internal"`, keyed by `clientId` + `createdByUserId` =
  admin); `web3Sites` (existing site rows keyed by `clientId`, read-only
  from this surface); `oasisNpcs` / `oasisNpcSessions` /
  `oasisNpcMessages` (Stephon conversation history);
  `executiveAgentApprovals` + executive-agent audit log
  (proposal/execution record). Client linkage throughout is `clients.id`
  (UUID) with ownership via `clients.userId = adminUserId`; no evidenced
  link from any of these to a generated site, a `userId` of the end
  client, or a preview host.
- **Troo-world / green-terrain vs. Stephon (limited check only):**
  separate system, on the evidence available:
  `stephon-site-builder-constants.ts` states `/** Platform desk scope —
  not a 3D world building. */`, and Stephon's world id is
  `STEPHON_WORLD_ID = "site-builder"` (`stephon-persona.ts`), versus the
  Troo-Town/green-terrain world id `"green-terrain"`. The Stephon
  overview reads OASIS NPC sessions, not world placements.

### 2e. Exists today vs. adapter must add

| Exists today (evidenced) | Adapter must add (not evidenced anywhere in the verified chain) |
|---|---|
| `stephon.projects`: read of `web3Sites` id/name/status/updatedAt by `clientId`, limit 20 | A defined "project" model for generated sites (schema, status lifecycle incl. building/failed/preview-ready, ownership, URL/file pointers) |
| `stephon.intake`: approval-gated write of one internal `clientNotes` brief row; ownership check; audit-logged execution | A generation executor (new action, not `createSiteBuilderTask`): brief → template/layout selection → file/HTML generation → test → preview URL → publish, with its own payload schema, storage, and client linkage |
| `buildStephonSiteBuilderOverview`: read-only, PII-masked NPC conversation overview | A job/receipt model (job id, stages, logs, artifact pointers, failure modes) and a gateway `receipt` surface wired to it |
| Approval row + audit log as the only execution record | Generation-specific approval semantics (what exactly is approved: the brief, the generated output, the publish step — currently approval covers only note creation) |
| Persona copy mentioning "generate layouts" | Grounding of that copy in a real generator, or correction of the copy; plus provider selection (LLM/template/hosting), cost, and sandboxing decisions |

## 3. The adapter to build

### 3.1 Proposed catalog entries (for Codex to confirm)

Do **not** register these until the implementation exists. A catalog entry
without an executor is the exact "connected because a function exists"
error this package forbids.

| Engine id | Mode | Purpose |
|---|---|---|
| `stephon.generate` (new) | approval | "Generate an actual website from an owned client's approved brief and deliver a preview URL. Generated files, tests, and the preview receipt are linked to the selected client. Publishing is a separate approved step." |
| `stephon.projects` (existing) | read | Unchanged — owned website project status. The adapter **extends** what this read returns (see §5.3): once a project model exists, this read must return the generated site's status, preview URL, and build receipt — not only `web3Sites` id/name/status/updatedAt. |

`stephon.intake` stays exactly as it is: it records a brief. It must
**not** be repurposed into a generation trigger — the name
`createSiteBuilderTask` already misleads (no task entity exists), and
folding generation into it would hide the approval boundary. Generation
is a **new action**, not an extension of the intake note.

### 3.2 Project model (new — must be defined before the executor)

A generated site needs a defined "project" model. **The inventory
narrows this decisively: the model already exists in outline as
`web3Sites` + `web3SiteVersions`.** `sites/route.ts` POST creates a
`web3Sites` row (`status: "DRAFT"`, `currentVersionId: null`, keyed by
`userId` + optional `clientId`/`trustId`/`workspaceId`); versions live
in `web3SiteVersions` (keyed by `siteId`, carrying `schemaJson`, and —
after deploy — `ipfsCid` + `buildManifestJson`); deploy sets
`web3Sites.status = "PUBLISHED"` and `currentVersionId`. The adapter
must therefore **extend this model, not invent a parallel one** — but
the full `web3Sites`/`web3SiteVersions` schemas (all columns, status
enum values) were **not read**, so the exact extension is Codex's to
finalise after reading them. Minimum required additions/confirmations
(field names are proposals, not a migration):

```ts
SiteGenerationProject {
  id: UUID;
  clientId: UUID;                 // clients.id; ownership via clients.userId = adminUserId
  title: string;                  // from the approved brief
  briefNoteId: UUID;              // the clientNotes row that is the approved brief
  status: "queued" | "building" | "test_failed" | "preview_ready" | "published" | "failed";
  templateId?: string;            // template/layout selection, if templates are reused (§4)
  previewUrl?: string;            // set only when status = preview_ready or published
  publishedUrl?: string;          // set only by the separate publish step (§3.5)
  files: { path: string; sha256: string; bytes: number }[];  // generated files
  buildJobId: UUID;               // link to the job/receipt model (§5.2)
  createdByAdminUserId: number;
  createdAt / updatedAt;
}
```

- Status lifecycle must include `building`, `test_failed`, and `failed`
  — a generation that cannot be tested, or that fails its tests, must
  never be reported as `preview_ready`. **Note the existing deploy
  conflates preview and publish:** it sets `status: "PUBLISHED"` and
  returns a public gateway URL in one call. The adapter must add a
  preview state (a version with a gateway URL that is **not** marked
  `PUBLISHED` — e.g. a preview-only deploy that uploads the bundle and
  records the CID on the version row without flipping the site status —
  or an explicit `preview_ready` status, Codex's call) and must never
  call raw deploy for a preview. See §3.5.
- The project row is created by the executor **after** approval, not at
  propose time. Proposing creates only the approval row. (Today a site
  row can also be created directly via `sites/route.ts` POST as an empty
  DRAFT — the adapter must state whether generation creates the site row
  itself or attaches to a DRAFT row created first, and which path the
  gateway uses.)
- `web3Sites` is the existing site table read by `stephon.projects`.
  The adapter must state explicitly whether the project model **is** a
  `web3Sites` row (with new columns), a new table, or a new table linked
  to `web3Sites` — and must read the full `web3Sites` schema + status
  enum first (not read at inventory time). Do not guess the schema.

### 3.3 Generation executor (new action, not `createSiteBuilderTask`)

Proposed executor action: `generateSiteFromBrief` (new action in
`EXECUTIVE_ACTION_EXECUTORS`).

Input schema (proposed, zod, strict — Codex to finalise):

```ts
GenerateSiteInputSchema = z.object({
  clientId: z.string().uuid(),
  briefNoteId: z.string().uuid(),       // the approved clientNotes brief (must exist, must belong to clientId)
  title: z.string().trim().min(1).max(500),
  templateId: z.string().trim().max(191).optional(),  // if a template is selected; else the generator chooses and records it
  pageSlug: z.string().trim().max(191).optional().nullable(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
}).strict();
```

Note: `pageSlug` and `priority` already exist on the executor-side
intake schema but are unreachable from the gateway (they silently
default). The generation input carries them explicitly, so the approved
payload is the complete generation instruction — no silent defaults.

Pipeline (each stage logged to the job, §5.2; a stage failure stops the
pipeline and sets status `failed` / `test_failed`):

1. **Load + validate the brief** — read the `clientNotes` row by
   `briefNoteId`; verify it belongs to `clientId` and was created by (or
   for) the approving admin; verify ownership again
   (`assertClientOwnedByAdmin`).
2. **Template/layout selection** — select a template (from
   `src/app/api/site-builder/templates/*` **if** the remaining inventory
   shows a usable template store — `templates/*` is still unread, so
   this is not established — else a defined template set — see §4).
   Record the selected `templateId` in the project row. If no template
   fits the brief, fail with `failed` and a reason — do not silently
   generate a generic page and call it the client's site.
3. **File/HTML generation — the brief → schema step: REUSE the
   existing pipeline, do not build a duplicate.** Call (or extract)
   `src/pages/api/site-builder/ai/pipeline.ts`, step `full`, with the
   brief + template: it runs `runSitePlanner` →
   `generateSiteSchemaFromPlanner` with content intelligence/critique,
   evaluation, and generation-intelligence persistence, and returns a
   `SiteSchemaDocument` (plus alternates, `generationMeta`,
   `intelligenceRunId`). The adapter then saves it as a
   `web3SiteVersions` row carrying its `schemaJson`. Before any provider
   use, the adapter validates that the selected client/site is owned by
   the requesting admin (the pipeline authenticates a user; it does not
   check client/site ownership). The pipeline's `generationMeta` must be
   carried into the job/receipt: `llmUsed`, `llmProvider`, `llmModel`,
   `fallbackReason`, `plannerPath` (`llm_enriched` vs
   `deterministic_fallback`), and `genericContentWarning` — a
   deterministic fallback or generic-content warning must be surfaced,
   never silently presented as LLM-generated finished copy. Provider,
   model, key env, and cost still come from the resolver body (unread)
   and must be recorded before the executor is built. **Do not
   introduce a second LLM provider and do not build a parallel
   brief→schema engine.**
4. **Test** — run the defined checks on the generated files (see §5.1):
   the site builds/renders, required pages exist, links resolve, no
   placeholder content is shipped as finished copy. A test failure sets
   status `test_failed` and the receipt carries the failure log — the
   preview URL is **not** minted.
5. **Preview URL — reuse the deploy route's second half, without its
   publish side-effect.** Only after tests pass: generate the static
   bundle from the saved version schema (`generateStaticBundle` —
   body unread), upload it to IPFS via Pinata
   (`uploadArbitraryJSONToIPFS`), record `ipfsCid` +
   `buildManifestJson` on the version row, and return the gateway URL
   `https://gateway.pinata.cloud/ipfs/<cid>`. **Do not call the raw
   deploy route for this step** — raw deploy sets `status: "PUBLISHED"`
   and calls `markLatestSiteGenerationRunPublished`. The adapter needs
   a preview-only variant (upload + record CID, no `PUBLISHED` flip,
   no publish-intelligence call — or an explicit decision, recorded,
   that a preview CID is public-by-URL and is acceptable as the
   preview). The preview URL must resolve to the generated files
   just tested — never to a different build. (Export's
   `buildDeploymentProjectFromSchema` proves the same schema→files
   step works without a saved site; it is the fallback if the version
   path cannot be used, but it produces a ZIP download, not a URL.)
6. **Publish (separate step, separate approval)** — publishing is **not**
   part of generation. A published URL is set only by a separate,
   separately approved publish action (§3.5) — in practice, the raw
   deploy route's `PUBLISHED` flip, gated by that approval.
   Generation must never publish, deploy, or mutate a live site.

### 3.4 Authenticated owner/client mapping

- Gateway route auth as for every catalog engine: NPC admin JWT
  (`admin-token` / `auth-token`, `verifyNpcAdminJwt`, `isAdmin: true`); no
  admin JWT → 401; same-origin POST → 403; 32 KB body cap → 413.
- Ownership: `ownedInput` must verify the `clientId` in the contract
  input (`clients.userId = adminUserId`, else 404) — unlike
  `stephon.projects`, whose client scoping lives only in server context.
  The generation input therefore carries `clientId` explicitly.
- The executor must re-check ownership before any generation work
  (`assertClientOwnedByAdmin`), because ownership can be revoked between
  propose and approve — the PR #21 audit's revoked-ownership test is the
  pattern.
- The generated files, project row, job, and preview URL are all keyed
  to `clientId`. No cross-client reads: `stephon.projects` must return
  only the requesting admin's clients' projects (today its ownership
  enforcement is the admin-JWT gate plus server context — the adapter
  must close that gap for the new project read, with a per-client check
  in the tool or the gateway, and state which).

### 3.5 Approval boundary — what exactly is approved

- Mode `approval`, following the existing three approval engines:
  `propose` inserts an `executiveAgentApprovals` row
  (`targetType: "engine:stephon.generate"`,
  `proposedAction: "generateSiteFromBrief"`, `payloadJson` = the
  validated input); `approve`/`reject` invoke the canonical approve/
  reject POST handlers **in-process**; execution goes through
  `executeExecutiveApprovedAction`, which locks the persisted row,
  refuses unless status is exactly `"approved"`, and dispatches **only
  from the persisted row's** `proposedAction`/`payloadJson`.
- `humanConfirmed` must be a literal `true` (`z.literal(true)`) at the
  gateway schema and at the canonical gate, as audited for PR #21.
- **Three distinct approvals, never collapsed into one:**
  1. **The brief** — already covered today by `stephon.intake` (approval
     to record the brief as a note). Generation does not re-approve the
     brief; it consumes the approved brief by `briefNoteId`.
  2. **The generation** — approval of the `generateSiteFromBrief`
     payload (client, brief, title, template, slug, priority). This
     authorises building + testing + minting a **preview** URL. It does
     **not** authorise publishing.
  3. **The publish step** — a separate proposal/action (to be specified
     when publishing is built; not in this adapter), authorising a
     previewed site to go live. No publish step is specified here, and
     generation must never publish. **Note:** the existing deploy route
     conflates preview and publish — one call uploads, records the CID,
     flips `status` to `PUBLISHED`, and calls
     `markLatestSiteGenerationRunPublished`. The adapter must split
     that: a preview-only variant for step 5, and the full deploy
     (with its `PUBLISHED` flip) only behind the publish approval.
- **The generated output itself is not approved by the generation
  approval** — the approval covers the instruction (brief + template),
  not the output. The output is verified by the tests in §5.1 and
  reviewed by the operator from the preview URL before any publish
  approval. The spec must not claim that approving generation approves
  the generated copy/design.
- Persona copy: `STEPHON_GREETING` ("generate layouts") must be grounded
  in the real generator once it exists, or corrected. Do not leave
  marketing copy claiming a capability the code does not have.

## 4. Reuse vs. new build — the `site-builder/*` decision

**Rule: reuse existing engines; do not introduce a paid provider or
duplicate a builder.** The adapter is built from the §2c inventory, in
this order. **Both halves are now settled as reuse** — the pipeline
(`src/pages/api/site-builder/ai/pipeline.ts`, step `full`) is the
brief→schema engine, and the deploy route is the build/preview engine.
What the adapter adds is the wiring between them plus ownership,
persistence, approval, tests, and a private preview.

1. **Build/preview (reuse — settled):** `sites/[siteId]/deploy/route.ts`
   is the reuse anchor: `generateStaticBundle(schema)` →
   `uploadArbitraryJSONToIPFS` (Pinata) → gateway URL, with `ipfsCid` +
   `buildManifestJson` on `web3SiteVersions`. The adapter reuses this
   path for the preview step (§3.3 step 5) **minus** the `PUBLISHED`
   flip. `export/route.ts` (`buildDeploymentProjectFromSchema` → ZIP)
   is the fallback schema→files proof and the source of the file format
   if the version path cannot be used.
2. **Brief → schema (reuse — settled 2026-11-03):**
   `src/pages/api/site-builder/ai/pipeline.ts`, step `full`:
   `runSitePlanner` → `generateSiteSchemaFromPlanner` (+ content
   intelligence/critique, evaluation, generation-intelligence
   persistence). The adapter is a wiring job: approved intake note →
   pipeline `full` (with client/site ownership validated first) →
   generated schema persisted as a `web3SiteVersions` row → existing
   deploy path for build/preview (§3.3 step 5, preview-only variant).
   **No duplicate brief→schema engine is built.** The pipeline's own
   auth is a session check only — ownership validation, version
   persistence, and the private preview/receipt are the adapter's new
   work, not the pipeline's.
3. **Templates** — `templates/*` is still unread. If it is a usable
   template store (list + read by id, with a schema), the generator
   selects from it. If it is only a CRUD list with no rendering, the
   adapter must define template selection separately.
4. **Draft/apply** — `draft-apply` applies actions to an **unsaved**
   draft schema and explicitly excludes full regen/imports/agent
   binding; `builder-actions` mutates a **saved** schema and logs an
   action run. The generator's output format (a `SiteSchemaDocument`
   in a version row) must be compatible with both — the version row is
   the handoff point between generation and the builder.
5. **AI / LLM** — a per-site LLM invoker already exists
   (`resolveSiteBuilderLlmInvokeForSite`, used by `builder-actions`
   and `execute-intent`). Record its provider, model, key env, and
   cost from the resolver body — and whether it is the generation
   mechanism or only an assistant. **Do not introduce a second LLM
   provider.** If no LLM path exists, the generation mechanism is
   template/deterministic, and any future LLM addition is a separate,
   costed decision.
6. **Deliverables / assets / assistant / import** — still unread (except
   `execute-intent`: analysis only, no mutation, with a 409
   schema-staleness guard). Record what each stores or executes, and
   whether the generated site's files, tests, or preview receipts
   belong there (notably: the fulfillment-deliverable link from
   `linkSiteBuilderDraftToFulfillmentDeliverable`, whose body was not
   read — the adapter must read it and state whether a generated site
   becomes a fulfillment deliverable, and if so, how). The deploy
   route's `markLatestSiteGenerationRunPublished` proves a "site
   generation run" record exists in `intelligence/` — the job model
   (§5.2) must align with it, not duplicate it.

The pipeline finding is pasted into §2c with file references above;
the remaining open items are the adapter's own work (ownership
validation, version persistence, private preview/receipt, fallback and
generic-content handling) plus the still-unread supporting inventory
(`versions/*`, `intelligence/`, `templates/*`, resolver body, full
schemas). Provider, model, key env, and cost must be recorded from the
resolver body before the executor is built.

## 5. Storage, job/receipt, and tests

### 5.1 Tests (acceptance — the generated site must pass these before a preview URL is minted)

- The generated files build/render without error (the exact build
  command is Codex's to define from the chosen generation mechanism).
- Required pages from the brief exist; no page is an empty shell.
- Internal links resolve; no link points at a placeholder host.
- No placeholder/lorem copy is shipped as finished copy (a defined
  placeholder list, checked mechanically; human review of copy is the
  operator's publish-step review, not this test).
- The generated files' hashes in the receipt match the files stored
  (§5.4) — the preview serves the tested files.
- A generation that fails any test sets status `test_failed`, writes the
  failure log to the job, and mints **no** preview URL.

### 5.2 Job/receipt model (new, mandatory)

Generation is long-running and multi-stage, so unlike QR (synchronous),
it needs a job record. **First check whether one already exists:**
the deploy route calls `markLatestSiteGenerationRunPublished` from
`src/lib/site-builder/intelligence/`, proving a "site generation run"
record exists there (body unread). The adapter's job model must align
with that record, not duplicate it. Minimum model (Codex to finalise,
after reading `intelligence/`):

```ts
SiteGenerationJob {
  id: UUID;
  projectId: UUID;
  approvalId: string;               // executiveAgentApprovals.id
  stages: { name: string; status: "pending"|"running"|"passed"|"failed"; startedAt?; finishedAt?; logRef?: string }[];
  // stages: load_brief, select_template, generate, test, store, preview
  artifactPointers: { path: string; sha256: string; bytes: number }[];
  previewUrl?: string;
  failure?: { stage: string; message: string };
}
```

Receipt (returned by the executor, stored with the job, and readable via
the gateway `receipt` surface — which today 404s for reads and returns
only the approval row + audit entry for approval actions; the adapter
must wire a `receipt` for `stephon.generate` to this job):

```json
{
  "projectId": "<uuid>",
  "jobId": "<uuid>",
  "clientId": "<uuid>",
  "briefNoteId": "<uuid>",
  "templateId": "<id>",
  "status": "preview_ready",
  "previewUrl": "<url>",
  "files": [{ "path": "...", "sha256": "<hex>", "bytes": 1234 }],
  "tests": { "passed": true, "checks": [{ "name": "...", "passed": true }] },
  "approvalId": "<executiveAgentApprovals.id>"
}
```

A receipt that points at files that do not exist, or at a preview URL
that does not resolve to the tested files, is not a receipt. The
executor result lands in the audit `outputJson`, as the Bentley
executors do for their counts.

### 5.3 Project read (`stephon.projects`, extended)

Once the project model exists, `stephon.projects` must return, per
project: `{id, name, status, updatedAt, previewUrl?, buildJobId?,
testStatus?}` — not only the four columns it returns today. The read
must be owner-scoped per client (see §3.4). The OASIS overview service
(`buildStephonSiteBuilderOverview`) is a **different** read (NPC
conversation history) and must not be conflated with it; its
`engineId: "site-builder-engine"` is not a gateway engine id.

### 5.4 Generated-file storage (settled in outline by the inventory — details open)

The deploy route fixes the storage contract: the bundle is uploaded to
IPFS via Pinata (`uploadArbitraryJSONToIPFS`, whole bundle as one JSON
payload including full `files[]` + `manifest`), `ipfsCid` +
`buildManifestJson` are stored on the `web3SiteVersions` row, and the
public URL is `https://gateway.pinata.cloud/ipfs/<cid>`. The adapter
**reuses this contract** — it does not invent a new file store. Open
details for Codex: Pinata key/plan/cost/limits (not evidenced —
`uploadArbitraryJSONToIPFS` body unread); whether a preview CID (not
marked `PUBLISHED`) is acceptable as a preview, given any holder of the
gateway URL can fetch it; and whether the bundle payload (which embeds
the full files) is the right shape for a preview, or a preview-only
upload shape is needed. The inbox attachment path also uses IPFS via
Pinata — if that is the same credential/plan, say so; if it is a
separate one, say so. **No silent external host:** Pinata is already
the platform's deploy host, but its cost/credentials for
Skipper-generated previews must still be recorded explicitly, and the
"no outside services unless completely required" rule addressed — the
deploy route already depends on it, so the question is whether the
adapter extends that dependency, not whether it introduces it.

### 5.5 Dependencies

- Internal: Drizzle/MySQL (`clientNotes`, `web3Sites` / new project
  table, new job table), approvals store, audit log, the `site-builder/*`
  handlers reused per §4.
- Generation mechanism: **open** — template renderer, deterministic
  layout generator, or LLM (provider/model/key/cost to be recorded from
  the §2c inventory; if an LLM is chosen, it is a new provider decision
  for Charles/Codex, with cost and sandboxing stated).
- **No paid provider is introduced by this spec.** Any provider in the
  implementation is a decision to be recorded, not a default.

### 5.6 What the adapter must NOT do

- Never repurpose `createSiteBuilderTask` / `stephon.intake` into a
  generation trigger.
- Never publish, deploy, or mutate a live site as part of generation.
- Never mint a preview URL for untested or failed output.
- Never register the catalog entry before the executor exists.
- Never adopt an external host/LLM silently as the generator or file
  store.
- Never claim the generation approval approves the generated output.

## 6. Acceptance checklist (for Codex / Charles)

- [ ] §2c inventory complete for the six handlers read; remaining gap
      (`ai/intelligence/*`, `versions/*`, action catalogue,
      `intelligence/` lib) closed or explicitly carried as the first
      implementation step (§7 step 1); reuse decision (§4) recorded
      with file/line refs.
- [ ] Full `web3Sites` / `web3SiteVersions` schemas read; project-model
      extension decided (§3.2) — extend `web3Sites` + versions, not a
      parallel model, unless a reason is recorded.
- [ ] `linkSiteBuilderDraftToFulfillmentDeliverable` body read; whether
      a generated site becomes a fulfillment deliverable stated.
- [ ] Brief→schema entry point found or built (§3.3 step 3, §4 step 2);
      generation mechanism chosen with provider, cost, sandboxing
      recorded — reusing the existing per-site LLM invoker if an LLM is
      used; no second LLM provider.
- [ ] Preview-only deploy variant defined (§3.3 step 5, §3.5): bundle
      uploaded, CID recorded on the version row, site **not** marked
      `PUBLISHED` by a preview; raw deploy never called for a preview.
- [ ] Project model + job/receipt model implemented (§3.2, §5.2),
      aligned with the existing "generation run" record in
      `intelligence/`; `stephon.projects` extended (§5.3) with
      per-client scoping (§3.4).
- [ ] Executor `generateSiteFromBrief` implemented: brief → template →
      generate → test → store → preview (§3.3); publish excluded (§3.5).
- [ ] Tests (§5.1) gate the preview URL; `test_failed` mints no URL.
- [ ] Approval boundary (§3.5): propose-only, canonical handlers,
      literal `humanConfirmed: true`, persisted payload only; three
      approvals (brief / generation / publish) kept distinct.
- [ ] Ownership + revoked-ownership tests pass; replay test passes (one
      execution per proposal).
- [ ] Receipt (§5.2) returns a resolving preview URL and file hashes
      matching the stored files; audit entry written.
- [ ] File-storage decision (§5.4) recorded with Pinata cost/credential
      consequences; preview CID public-by-URL accepted or mitigated
      explicitly; no silent external host.
- [ ] Live execution evidence: a real generation against a real DB, with
      the preview URL opened and the receipt read back — not fixtures only.
- [ ] Persona copy grounded or corrected (§3.5).

## 7. Recommended implementation order

1. **Pipeline reuse + ownership/persistence design** — confirm the
   `pipeline.ts` `full` call contract (inputs, `generationMeta`,
   `intelligenceRunId`) against the current head; design the
   client/site ownership check that runs before provider use, the
   version-row persistence of the returned schema, and the
   `generationMeta` surfacing (fallback + generic-content warnings).
   Close the remaining supporting inventory in parallel:
   `sites/[siteId]/versions/*`, `src/lib/site-builder/intelligence/*`,
   the `provider-resolver` body (provider/model/key/cost), and the full
   `web3Sites`/`web3SiteVersions` schemas.
2. **Project model + job/receipt model** (§3.2, §5.2) — extend
   `web3Sites` + versions; align the job with the existing
   generation-run record (`recordSiteGenerationFullRun`).
3. **Preview-only deploy variant + tests-first executor** — implement
   the pipeline with the §5.1 tests gating the preview URL; no preview
   without passing tests; no `PUBLISHED` flip on preview.
4. **Gateway adapter** — catalog entry `stephon.generate`, executor
   wiring, approval boundary (§3.5), ownership re-check, receipt
   surface, extended `stephon.projects` read.
5. **Publish step (separate)** — specified and built only after
   generation + preview are proven; never bundled into generation.
   (In practice: the raw deploy route's `PUBLISHED` flip, behind its
   own approval.)
6. **Live verification** — real generation against a real DB, preview
   URL opened, receipt read back. Fixture tests alone do not close this
   adapter.

## 8. Open questions for Charles / Codex

- Generation mechanism: **settled as reuse** — `src/pages/api/site-builder/ai/pipeline.ts`, step `full`. Open: what does the existing per-site invoker (`provider-resolver`) use (provider/model/key/cost), and how is the pipeline invoked from the executor (in-process service call vs. internal HTTP)?
- Preview vs. publish: is a preview CID that is public-by-URL
  acceptable as the preview, or must previews be gated some other way?
- File storage: Pinata is already the deploy host — is extending that
  dependency to Skipper-generated previews acceptable, at what
  cost/plan, and under which credentials?
- Project-model home: extend `web3Sites` + `web3SiteVersions` (the
  inventory's finding) or a separate model — and what are the full
  schemas/status values?
- Publish step: is a separate publish approval the right model, and who
  reviews the generated output before publish (operator, client, both)?
- Template source: the existing `templates/*` store (still unread), a
  new curated set, or client-supplied templates?
