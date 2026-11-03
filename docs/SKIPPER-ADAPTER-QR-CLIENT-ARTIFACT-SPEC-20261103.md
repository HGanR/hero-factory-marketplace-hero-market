# Adapter Specification — QR Generation into an Owned Client Workspace — DRAFT

**Date:** 2026-11-03
**Repo:** `HGanR/hero-factory-marketplace-hero-market`
**Base head:** PR #21 `0db3b8c58e3d7414603f4439e1a3ca1e1e2adbcf`
(branch `feat/skipper-audited-engine-integration-20261103`)
**Status:** Specification only. No code, schema, approval-gate, deployment, or
provider change. No paid provider is introduced. Codex owns executable
implementation after review, within Charles's authorized scope.
**Work package:** `docs/SKIPPER-MUSE-PARALLEL-WORK-20261103.md` (in PR #21).

## 1. Goal

An authenticated paired SKIPPER should be able to generate a QR code for a
client-owned URL, save the rendered PNG/SVG **as an artifact in the selected
owned client workspace**, and report completion with a receipt and a
decode-verified quality check — instead of today's browser-only flow, where
the PNG/SVG exists only as a browser download and the server stores only a
URL string.

A catalog entry, a config row, or an approval is not a completed product.
The adapter is done only when a generated file exists server-side, is owned
by the right workspace, and decodes to the intended link.

## 2. What exists today (evidenced)

A full client-side QR generator page, **not** a server engine.
`src/app/qr-maker/page.tsx` (915 lines, `"use client"`, line 1):

- Line 5: `import QRCode from "qrcode";`
- Lines 35–40 `isProbablyUrl()`: `new URL(value)` and only `http:`/`https:`
  accepted.
- Lines 225–228 `finalUrl`: valid URL only; unique mode appends
  `?qrid=<uuid>` via `addOrReplaceParam` (lines 45–47).
- Line 357: `QRCode.create(finalUrl, { errorCorrectionLevel: ecc })`, then a
  custom canvas renderer draws modules (square/rounded/dots/squircle, custom
  finder eyes, gradient, contrast-based scan-safety score, lines 230–339).
- Lines 429–435 `downloadPng()`: `canvas.toDataURL("image/png")` → browser
  download (`qr_<token8>.png`).
- Lines 438–528 `downloadSvg()`: rebuilds the QR from `QRCode.create` and
  serialises hand-built SVG → browser download.
- Lines 549–586 `saveToWorkspace()`: `POST /api/app/qr-save` with
  `{ workspaceId, name, config: { url: finalUrl, token, uniqueMode } }`,
  credentials included. Workspace id comes from `localStorage` key
  `smart_trust_platform_binding_v1` (lines 9–21, 535–547).

Server side — `src/app/api/app/qr-save/route.ts` (61 lines, POST only):
`requireUserId(req)` (auth), then loads the `trusts` row by `workspaceId`
and returns 403 unless `trusts.userId === userId`. Inserts one `trustAssets`
row: `assetType: "qr_code"`, `description` = JSON string
`{ type:"qr_code", url, token, uniqueMode, createdAt }`. **It stores the
config (URL string) only — no PNG/SVG bytes, no server-side QR rendering,
no file/bucket.**

### 2a. URL validation / encoding (today)

- Client: `isProbablyUrl` — http/https only, no allowlist, no blocklist, no
  length cap beyond the scan-safety warning at >120/200 chars (lines
  289–295). Encoding is done by the `qrcode` library's `QRCode.create` on
  the final URL string.
- **Server: no validation at all.** `qr-save` copies
  `config.url ?? body?.url ?? ""` into the stored JSON verbatim; it never
  parses the URL.

### 2b. SSRF surface (today)

**None evidenced.** No code in the QR page or `qr-save` ever `fetch()`es
the user-supplied URL — the only `fetch` in the page is the
`POST /api/app/qr-save` save call. The URL is encoded locally into a matrix
and downloaded locally; the server only stores the string. (Risk note: the
stored URL string is later rendered/consumed by whatever reads
`trustAssets` — that consumer was not traced; no fetch of it was found in
the files read.) The adapter must **preserve** this property: the server
must never fetch the user-supplied URL. Validation and encoding are local
string/matrix operations only.

### 2c. Decode test (today)

**Not found / not evidenced.** The `package.json` `test` script enumerates
its spec files explicitly and contains no QR spec; no QR test file was found
in the listings examined, and no decode/round-trip step exists in the page
or route. The page's only correctness signal is its own heuristic
scan-safety score (contrast, quiet zone, ECC, density) — not a decode.

### 2d. Dependency discrepancy — must be resolved before the adapter is built

**`qrcode` is imported but absent from `package.json`.** The full
`package.json` was read: dependencies include `three`,
`@react-three/drei`, `konva`, `jspdf`, `html2canvas`, etc., but no `qrcode`
in `dependencies` or `devDependencies`. Whether it resolves transitively /
via a lockfile was not verified (lockfile presence not checked). The page
would fail a clean build if the import does not resolve. **Acceptance gate
0: prove a clean build (or declare the dependency explicitly with a pinned
version) before any adapter work is called working.**

### 2e. Field table (today)

- **Input schema:** No zod/server schema. Client state: `rawUrl`, `ecc`
  (L/M/Q/H), `moduleShape`, `sizePx`, `quietZone`, colours,
  `uniqueMode`+`token` (`page.tsx:200–228`). Save body:
  `{ workspaceId, name, config:{url,token,uniqueMode} }` (lines 561–573).
- **Authenticated owner/client mapping:** Save: `requireUserId(req)` +
  `trusts.userId === userId` else 403 (`qr-save/route.ts`). Owner = trust
  owner. Rendering/download itself: no auth (public page, client-only).
- **Concrete entry point:** Page `src/app/qr-maker/page.tsx` (`renderQr`,
  line 348); save `POST /api/app/qr-save` (`route.ts`). No server QR-render
  route exists.
- **Existing approval boundary:** **None.** No approval row, no
  `validateApprovalGate`, no propose-only path. Save is direct execution
  after auth+ownership. Download needs no auth at all.
- **Returned artifact(s):** Browser-downloaded PNG/SVG (client); save
  returns `{ id, workspaceId }` only.
- **Storage destination:** `trustAssets` table, `assetType="qr_code"`,
  config JSON in `description`. No image bytes stored anywhere.
- **Job/receipt format:** None — only the `trustAssets` row +
  `{ id, workspaceId }` response. No job, receipt, or audit entry.
- **Dependencies:** `qrcode` (imported, **not declared**); `drizzle-orm`,
  `getDb`, `requireUserId` (server save). No external provider, no paid
  service.
- **Classification:** Browser-only — **yes**. Callable server engine —
  **no**. Provider readiness — n/a. Live execution evidence — none for a
  server-side QR operation (none exists).

## 3. The adapter to build (new build, not a wiring)

There is no server QR-render operation to wire. The adapter is a **new
server-side production engine** built on top of the existing persistence
(`trustAssets` config row) and the existing client renderer (which may be
reused as the reference implementation for module layout, styling, and the
scan-safety heuristic — but the server must not depend on the browser).

### 3.1 Proposed catalog entry (for Codex to confirm)

| Field | Value |
|---|---|
| Engine id | `qr.generate` (new; name to confirm — do not reuse `qr-maker`, which is a page) |
| Agent | skipper |
| Mode | `approval` (proposal-based action — see §3.5) |
| Purpose | "Generate a QR code for an owned client's URL and save the rendered PNG/SVG as an artifact in the selected owned workspace. The server never fetches the supplied URL." |
| Executor action (new) | `generateQrCode` (new action in `EXECUTIVE_ACTION_EXECUTORS`; must not be added to any existing action) |

Do **not** register this engine until the implementation exists. A catalog
entry without an executor is the exact "connected because a function
exists" error this package forbids. The catalog descriptor must state that
registration is not proof of provider readiness or completed work, as the
existing contract header already does.

### 3.2 Input schema (proposed, zod, strict)

```ts
GenerateQrInputSchema = z.object({
  workspaceId: z.string().uuid(),          // the owned client workspace (trusts.id)
  url: z.string().trim().min(1).max(2048), // user-supplied URL, validated server-side (§3.3)
  name: z.string().trim().min(1).max(191).optional(),
  ecc: z.enum(["L", "M", "Q", "H"]).default("M"),
  moduleShape: z.enum(["square", "rounded", "dots", "squircle"]).default("square"),
  sizePx: z.number().int().min(128).max(2048).default(512),
  quietZone: z.number().int().min(0).max(16).default(4),
  foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  uniqueMode: z.boolean().default(false),
}).strict();
```

Notes:
- `workspaceId` is the **owner mapping** (see §3.4). It must be present in
  the contract input so `ownedInput` can enforce it — unlike
  `stephon.projects`, whose client scoping lives only in server context and
  is therefore unenforceable per-request.
- Styling fields default to the page's current defaults; the spec does not
  invent new styles. Styled variants (rounded/dots/squircle, gradients,
  custom finder eyes) are the riskier decode cases and must each pass the
  decode test (§3.6).
- `uniqueMode` appends `?qrid=<uuid>` exactly as the page does today
  (`addOrReplaceParam`); the token is generated server-side with
  `crypto.randomUUID()` and recorded in the receipt, never accepted from the
  caller.

### 3.3 URL validation and encoding — without fetching arbitrary URLs

**Server-side validation (new, mandatory; the client check is not a
substitute):**

1. Parse with `new URL(url)`; reject on parse failure.
2. Scheme must be exactly `http:` or `https:` — reject `javascript:`,
   `data:`, `file:`, `ftp:`, protocol-relative, and schemeless strings.
3. Length: reject URLs over 2048 characters (QR capacity + the page's own
   >200-char scan-safety warning; the exact cap is a Codex decision, but a
   cap must exist — today there is none server-side).
4. No allowlist/blocklist of hosts is specified here — the URL is never
   fetched, so a host list adds no safety; if a future consumer ever fetches
   a stored QR URL, that consumer must add its own allowlist and SSRF
   review at that time. Record this as an open dependency in the receipt
   (see §3.7).
5. Reject URLs containing controls/whitespace that survive trimming, and
   reject a URL whose encoded form differs from the validated form (encode
   exactly the validated string — no re-serialisation that could smuggle a
   different target).

**Encoding (local only, no network):**

6. Encode the validated URL string with the `qrcode` library
   (`QRCode.create`, same call the page uses today) at the requested ECC
   level. This is a pure string→matrix operation; it performs no network
   I/O. The server must **never** `fetch(url)`, `fetch` any URL derived
   from it, or pass it to any HTTP client, image loader, or metadata
   fetcher. A test must assert this (see §3.6, test 3).
7. Render PNG and SVG from the same matrix the decode test reads (§3.6),
   so the file that is stored is the file that was verified — never render
   one matrix for the test and a different one for storage.
8. Dependency: resolve §2d first. Pin `qrcode` in `package.json` (or replace
   it with an explicit, declared alternative — Codex's call) and prove a
   clean build. The server renderer must import the same declared package;
   a transitive resolution is not acceptable for a production adapter.

### 3.4 Authenticated owner/client mapping

- Gateway route auth as for every catalog engine: NPC admin JWT
  (`admin-token` / `auth-token`, `verifyNpcAdminJwt`, `isAdmin: true`); no
  admin JWT → 401; same-origin POST → 403; 32 KB body cap → 413.
- Ownership: `ownedInput` must verify the `workspaceId` against the
  calling admin — the existing `qr-save` rule is the model:
  `trusts.userId === userId` (there, `requireUserId(req)` + the `trusts`
  row), else 403/404. The adapter must state explicitly which table and
  column carries the ownership link (`trusts.userId` vs. the gateway's
  `clients.userId = adminUserId` pattern) and must not invent a new
  ownership model: reuse the `qr-save` mapping, and record any mismatch
  between the trust-owner model and the gateway's client-owner model as a
  design decision for Codex, not a silent default.
- The executor must re-check ownership before writing (as
  `runCreateSiteBuilderTask` does with `assertClientOwnedByAdmin`), because
  the approval row is created at propose time and ownership can be revoked
  before approval — the PR #21 audit's revoked-ownership test is the
  pattern to follow.
- Rendering itself stays unauthenticated only in the browser page; the
  **server** generation path requires admin JWT + ownership. Do not expose
  an unauthenticated server render route.

### 3.5 Approval boundary

- Mode `approval`, following the existing three approval engines:
  `propose` inserts an `executiveAgentApprovals` row
  (`targetType: "engine:qr.generate"`, `proposedAction: "generateQrCode"`,
  `payloadJson` = the validated input); `approve`/`reject` invoke the
  canonical approve/reject POST handlers **in-process** (no self-HTTP);
  execution goes through `executeExecutiveApprovedAction`, which locks the
  persisted row, refuses unless status is exactly `"approved"`, and
  dispatches **only from the persisted row's** `proposedAction`/
  `payloadJson` (never from caller-supplied values at execution time).
- `humanConfirmed` must be a literal `true` (`z.literal(true)`) at the
  gateway schema and at the canonical gate, as audited for PR #21.
- What exactly is approved: **the generation of this QR for this URL in
  this workspace, with these styling options** — not a blanket permission
  to generate QRs. The approval row's payload is the complete, validated
  input; a changed URL, workspace, or style is a new proposal.
- No publication step exists for QR (there is nothing to publish); do not
  add one. The artifact is saved into the owned workspace on execution.

### 3.6 Output, decode test, and quality checks (acceptance)

**Output (both formats, from the same verified matrix):**

- PNG: rendered at `sizePx` (default 512), filename
  `qr_<token8>.png` (matching the page's current download name).
- SVG: serialised from the same `QRCode.create` matrix (matching the
  page's current SVG builder), filename `qr_<token8>.svg`.
- Both files are stored server-side (see §3.7). The browser download
  remains available from the page, but it is **not** the artifact — the
  server-stored files are.

**Decode test (mandatory; this is the acceptance proof the page lacks):**

1. **Round-trip decode:** for every generated QR (each ECC level, each
   module shape, default and styled variants), decode the stored PNG **and**
   the stored SVG with an independent decoder (a decode library or a
   reference decoder — Codex to select; it must not be the same code path
   that encoded it) and assert the decoded string equals the validated
   `finalUrl` exactly, including the `?qrid=<uuid>` suffix when
   `uniqueMode` is on. A generation that does not decode to the intended
   link is a failure, not a warning.
2. **Styled-variant coverage:** rounded/dots/squircle modules, custom
   finder eyes, and gradient fills are the variants the page itself scores
   as riskier. Each must pass the decode test; any variant that cannot be
   decoded reliably must be refused by the server schema (or downgraded to
   a decodable style with the downgrade recorded in the receipt) — never
   shipped undecoded.
3. **No-fetch assertion:** a test that stubs/monitors network access and
   asserts the generation path performs zero HTTP fetches of the
   user-supplied URL (and zero fetches of any URL derived from it).
4. **Validation rejection tests:** `javascript:` / `data:` / schemeless /
   over-length / unparseable URLs are rejected with 400 and produce no
   artifact, no approval execution, and no stored row.
5. **Ownership tests:** a non-owning admin gets 404 with no mutation (the
   PR #21 audit's non-owning-admin test is the pattern); revoked ownership
   between propose and approve blocks execution with the row staying
   `pending`.
6. **Replay test:** concurrent approves of the same proposal execute the
   generation once (canonical gate atomic claim; the PR #21 audit's
   4-concurrent-approves test is the pattern). A second decide after a
   lost response returns 409 and does not regenerate.

**Quality checks beyond decode:** retain the page's scan-safety heuristic
(contrast, quiet zone, ECC, density) as a **warning** in the receipt, not
as a substitute for decoding. Record the heuristic score and the decode
result together.

### 3.7 Storage destination and receipt

**Storage — two linked records, both required:**

| Record | Table / location | Contents |
|---|---|---|
| Config row (existing) | `trustAssets`, `assetType="qr_code"` | Existing JSON description `{ type:"qr_code", url, token, uniqueMode, createdAt }`, plus the new `assetId` pointers below (extend the JSON; do not break existing readers — the extension fields are additive) |
| Rendered files (new) | **To be decided by Codex** — see below | PNG bytes + SVG bytes/text, with content hash, byte size, ECC, module shape, and the validated `finalUrl` |

**File-storage decision (open, Codex's call — do not guess):** the
`trustAssets` table today stores only a config string; there is no file/
bucket in the QR path. The adapter must choose one of: (a) store the PNG/
SVG bytes (or data-URLs) in a new table/columns alongside the config row;
(b) write them to the platform's existing file/asset storage, if one is
evidenced (the inbox attachment path uses IPFS via Pinata — that is an
external host and a paid/credentialled dependency, and must **not** be
adopted silently; if it is proposed, its cost, credentials, and the
"no outside services unless completely required" rule must be addressed
explicitly); (c) store them under the app's own static/asset area with a
stable URL. Whichever is chosen, the receipt must carry a retrievable
pointer (URL or id) to **both** files, and the files must be owned by the
same workspace (`trustId = workspaceId`).

**Receipt (new, mandatory):** the approval row + `approval_execute` audit
entry (shared gateway plumbing) **plus** a QR receipt record returned by
the executor and stored with the artifact:

```json
{
  "qrAssetId": "<trustAssets.id>",
  "workspaceId": "<trusts.id>",
  "url": "<validated finalUrl>",
  "token": "<uuid, when uniqueMode>",
  "ecc": "M",
  "moduleShape": "square",
  "png": { "pointer": "<retrievable pointer>", "bytes": 1234, "sha256": "<hex>" },
  "svg": { "pointer": "<retrievable pointer>", "bytes": 5678, "sha256": "<hex>" },
  "decode": { "png": true, "svg": true, "decodedUrl": "<finalUrl>" },
  "scanSafety": { "score": "<heuristic>", "warnings": [] },
  "approvalId": "<executiveAgentApprovals.id>"
}
```

A receipt that points at files that do not exist, or that were never
decoded, is not a receipt. The executor result (including the decode
booleans and hashes) lands in the audit `outputJson`, as the Bentley
executors do for their counts.

**Job model:** no separate job table is specified here — generation is
synchronous in the executor (QR rendering is fast and local). If Codex
finds generation must be asynchronous, a job row (job id, stages, logs,
artifact pointers, failure modes) must be specified then, with a gateway
`receipt` surface wired to it. Do not invent a job table pre-emptively.

### 3.8 Dependencies

- `qrcode` npm package (declared + pinned after §2d; the server renderer
  and the page must use the same declared version).
- An independent QR **decoder** for the test (Codex to select; test-only
  dependency is acceptable).
- Internal only otherwise: Drizzle/MySQL (`trustAssets`, `trusts`),
  `requireUserId` / admin JWT, approvals store, audit log. **No external
  provider, no paid service, no network fetch of the target URL.**

### 3.9 What the adapter must NOT do

- Never fetch the user-supplied URL (or any URL derived from it).
- Never store a URL string and call it a QR artifact — the rendered
  PNG/SVG bytes are the artifact.
- Never expose an unauthenticated server render route.
- Never register the catalog entry before the executor exists.
- Never adopt IPFS/Pinata (or any external host) silently as the file
  store — that is a provider decision for Charles/Codex, with cost and
  credentials addressed explicitly.

### 3.10 Acceptance checklist (for Codex / Charles)

- [ ] Gate 0: `qrcode` dependency resolved; clean build proven.
- [ ] Server-side URL validation (§3.3 steps 1–5) implemented and tested
      (rejection tests, §3.6 test 4).
- [ ] Server render produces PNG + SVG from the same matrix; both stored
      server-side in the owned workspace (§3.7).
- [ ] Decode test (§3.6 tests 1–2) passes for every ECC level and module
      shape, including styled variants.
- [ ] No-fetch assertion (§3.6 test 3) passes.
- [ ] Ownership + revoked-ownership tests (§3.6 test 5) pass.
- [ ] Replay test (§3.6 test 6) passes — one execution per proposal.
- [ ] Approval boundary (§3.5): propose-only, canonical handlers,
      literal `humanConfirmed: true`, persisted payload only.
- [ ] Receipt (§3.7) returns retrievable pointers to both files, with
      hashes and decode booleans; audit entry written.
- [ ] File-storage decision (§3.7) recorded with its cost/credential
      consequences; no silent external host.
- [ ] Live execution evidence: a real generation against a real DB,
      decoded, with the receipt read back — not fixtures only.

## 4. Recommended implementation order

1. **Gate 0** — resolve the `qrcode` dependency and prove a clean build.
   (Blocks everything else; a page that cannot build cannot be called
   working.)
2. **Server validation + encoder (no storage yet)** — zod schema,
   validation steps 1–5, local `QRCode.create` encoding, no-fetch
   assertion. Unit-tested, no gateway wiring.
3. **Decode test harness** — independent decoder, round-trip tests for
   all ECC/shape/style combinations. This is the acceptance proof; build
   it before the storage decision so the storage choice cannot weaken it.
4. **File-storage decision** (§3.7) — Codex/Charles pick (a)/(b)/(c) with
   cost/credentials stated. Then implement the `trustAssets` extension +
   file writes.
5. **Gateway adapter** — catalog entry `qr.generate`, executor
   `generateQrCode`, approval boundary (§3.5), ownership re-check,
   receipt (§3.7).
6. **Live verification** — real generation against a real DB, decode the
   stored files, read the receipt back. Fixture tests alone do not close
   this adapter.

## 5. Open questions for Charles / Codex

- File-storage choice (§3.7): new table/columns, existing platform file
  storage, or app static area? Is IPFS/Pinata (already used for inbox
  attachments) acceptable for QR artifacts, with its cost/credentials?
- Is `mode: "approval"` (propose-only, human-confirmed) the right boundary
  for QR generation, or should a cheaper read-like path apply? (This spec
  proposes approval, matching the other production actions; Charles may
  direct otherwise.)
- Exact URL length cap (proposed 2048) and whether any host allowlist is
  wanted for future consumers of stored QR URLs.
- Decoder library selection for the decode test (Codex's call).
