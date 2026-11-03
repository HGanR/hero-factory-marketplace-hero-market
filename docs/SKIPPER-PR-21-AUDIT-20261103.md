# PR #21 Acceptance Audit — 2026-11-03

**Deliverable of the Muse work package (`docs/SKIPPER-MUSE-PARALLEL-WORK-20261103.md`). Documentation only; no code, schema, gate, or deployment change.**

# PR #21 Acceptance Audit — REPORT (DRAFT)

**Date:** 2026-11-03 (audit run ~06:20 EST)
**Auditor:** Aura (read-only; no merge, deploy, modification, or PR approval)
**Scope:** Code compliance of draft PR #21 against the 8 acceptance conditions in the Muse work
package (`docs/SKIPPER-MUSE-PARALLEL-WORK-20261103.md`), using the STEP 2 work order and the
adopted charter v1.0 for approval-gate context. Live website verification, native Mac testing,
and membership-collection verification are separate acceptance items and are NOT VERIFIED here.
No live calls, sends, builds, payments, or publications were made.

## Overall verdict

**8 PASS, 0 FAIL out of 8 acceptance conditions.**

All eight conditions pass on code reading at the reviewed head. The gateway only dispatches
registered catalog IDs, enforces server-side ownership, routes decisions through the canonical
STEP 0/STEP 2 approve/reject handlers (the older independent claim/execute/finish ports are
removed), requires a literal `humanConfirmed: true`, persists the action/payload before any
execution, cannot double-dispatch on replay, reads the inbox without sending, and its capability
claims match the code and tests.

## PR audited (exact head)

| Item | Value |
|------|-------|
| PR | HGanR/hero-factory-marketplace-hero-market #21 — "Connect paired SKIPPER engine gateway to audited approvals and Executive Inbox" |
| Head SHA | `0db3b8c58e3d7414603f4439e1a3ca1e1e2adbcf` |
| Branch | `feat/skipper-audited-engine-integration-20261103` |
| Base | `feat/skipper-app-db-readiness-20261103` |
| State | Draft, open, unmerged |

Note on the base: the PR description says it ports the gateway "onto the STEP 2 branch" and the
delivery doc says it ports onto "diagnostic PR #20 at `bad4cbeaf92a8c3db7640d7a00af4f3ff602b26a`".
The recorded base branch is `feat/skipper-app-db-readiness-20261103` (the PR #20 line), not the
STEP 2 branch `feat/skipper-step2-decision-engine-20261103`. This is a factual note on lineage,
not a criterion failure — the canonical handlers it invokes are the audited STEP 0/STEP 2
handlers, and this PR does not modify them.

## Files in the PR (9, all added)

| File | Status | Lines |
|------|--------|-------|
| `src/app/api/admin/executive-agent/engine-runtime/route.ts` | added | +41 |
| `src/lib/executive-agent/engine-runtime-contract.ts` | added | +65 |
| `src/lib/executive-agent/engine-runtime-core.ts` | added | +53 |
| `src/lib/executive-agent/engine-runtime-service.ts` | added | +62 |
| `src/lib/executive-agent/engine-runtime.spec.ts` | added | +68 |
| `tests/engine-integration/gateway.test.mjs` | added | +124 |
| `docs/SKIPPER-ENGINE-INTEGRATION-20261103.md` | added | +30 |
| `docs/SKIPPER-MUSE-PARALLEL-WORK-20261103.md` | added | +27 |
| `.github/workflows/skipper-engine-integration.yml` | added | +31 |

## The five gateway files ported (verified)

All five exist on `recovery-from-prod` at `77bed1c090dac758724130e4d803a950ae7581b6`
(verified by direct read at that SHA):

1. `src/app/api/admin/executive-agent/engine-runtime/route.ts` (recovery: 2,304 chars; PR #21: 3,312 chars — larger because of the canonical-handler wiring)
2. `src/lib/executive-agent/engine-runtime-contract.ts` (recovery: 5,525 chars; PR #21: 5,798 chars)
3. `src/lib/executive-agent/engine-runtime-core.ts` (recovery: 3,205 chars; PR #21: 3,178 chars)
4. `src/lib/executive-agent/engine-runtime-service.ts` (recovery: 4,789 chars; PR #21: 4,751 chars)
5. `src/lib/executive-agent/engine-runtime.spec.ts` (recovery: 4,953 chars; PR #21: 5,162 chars)

## Catalog file and inbox entry point

- **Catalog file:** `src/lib/executive-agent/engine-runtime-contract.ts` — `ENGINE_CATALOG`
  (13 entries) and `InputSchemas` (zod input validation per engine).
- **Inbox read entry point:** the `executive.inbox` case in the `read` switch of `operateEngine`
  in `src/lib/executive-agent/engine-runtime-service.ts`, which calls
  `listDepartmentMessagesForExecutiveAdmin(db, 120)` and
  `listApprovedMarketplaceUsers(db, 2500)` from
  `@/lib/executive-agent/executive-department-inbox-store`.

---

## Condition 1 — Only registered engine IDs — **PASS**

**Evidence:**
- `src/lib/executive-agent/engine-runtime-contract.ts` — `ENGINE_CATALOG` defines exactly 13
  entries, and `EngineId` is the union of those IDs (`export type EngineId = typeof
  ENGINE_CATALOG[number]["id"]`).
- `EngineRequest` is a zod discriminated union with `engineId: z.enum(ids)` (where `ids` is
  derived from `ENGINE_CATALOG`). Any engineId not in the catalog fails zod validation and the
  route returns 400 (`route.ts` maps `ZodError` to 400).
- `InputSchemas` is keyed by the same 13 IDs; `resolveEngineInput` parses input against the
  per-engine schema.
- `writeActionForEngine` throws `"This engine does not accept execution proposals."` for any ID
  that is not one of the three approval engines, so a read-mode engine can never produce an
  execution action.
- The core's `read` path looks up the engine in `ENGINE_CATALOG` and throws
  `'Execution requires a reviewed proposal.'` for a non-read engine; the `propose` path throws
  `'This engine is read-only.'` for a non-approval engine.

**Reason:** the catalog is the single source of engine IDs, the request schema enforces it, and
no ad-hoc ID can reach dispatch.

## Condition 2 — Server-side ownership — **PASS**

**Evidence:**
- `src/lib/executive-agent/engine-runtime-service.ts`, `ownedInput(db, adminUserId, input)`:
  for a `clientId`, it queries `clients` where `id = input.clientId AND userId = adminUserId`
  and throws 404 `"Client unavailable to this account."` if no row; for a `campaignId`, it
  queries `campaigns` where `id = input.campaignId AND userId = String(adminUserId)` and throws
  404 `"Campaign unavailable to this account."` if no row. This runs server-side.
- The core calls `ports.owned(input)` before every read and propose, and `ports.owned(payload)`
  before every approve — so ownership is re-checked at decision time, not only at proposal time.
- `getExecutiveApprovalById(db, id, adminUserId)` takes the admin ID, so a row is only returned
  if owned by that admin (ownership enforcement in the store, verified in the STEP 0 audit).
- `tests/engine-integration/gateway.test.mjs`, test "a non-owning admin cannot decide or read an
  engine receipt": approve with a different admin (owner 8) returns 404, receipt returns 404,
  the row stays `pending`, and there are zero executions.
- Same file, test "revoked client ownership prevents launching an existing proposal": after
  ownership is revoked, decide returns 404, the row stays `pending`, and there are zero
  executions.

**Reason:** ownership is enforced server-side against the admin's own client/campaign rows and
the owned approval row, and a foreign admin receives a 404 with no mutation.

## Condition 3 — Canonical approve/reject handlers — **PASS**

**Evidence:**
- `src/app/api/admin/executive-agent/engine-runtime/route.ts` imports the existing handlers:
  `import { POST as approve } from "@/app/api/admin/executive-agent/approvals/[id]/approve/route"`
  and `import { POST as reject } from "@/app/api/admin/executive-agent/approvals/[id]/reject/route"`.
- The `decide` callback invokes the existing POST handler **in-process**: it constructs a
  `NextRequest` to the canonical path
  (`/api/admin/executive-agent/approvals/${encodeURIComponent(id)}/${operation}`) and calls
  `(operation === "approve" ? approve : reject)(decision, {params:Promise.resolve({id})})`.
  The comment states: "Invoke the existing POST handler in-process; no self-HTTP or alternate
  dispatcher." No self-HTTP fetch is made. If the handler does not return `ok: true`, the
  gateway throws `EngineRuntimeError("The gated decision did not confirm success. Read the saved
  receipt before retrying.", ...)`.
- The older gateway's independent ports are **removed**: the PR #21 core's `EnginePorts`
  interface has only `get`, `owned`, `create`, `decide`, `receipt`, `read` — no `claim`,
  `execute`, or `finish`. Verified against `recovery-from-prod` @ `77bed1c09`: that core has
  `claim:(id:string)=>Promise<boolean>`, `execute:(row:Approval)=>Promise<{ok:boolean}>`, and
  `finish:(id:string,ok:boolean)=>Promise<void>`, and uses them (`if(!await ports.claim(row.id))…`,
  `const result=await ports.execute(row)`, `await ports.finish(row.id,result.ok)`), with zero
  lines containing "decide". The removal claim is confirmed.
- The canonical handlers are **unchanged by this PR**: the PR's file list contains 9 files, all
  `added` — the approve/reject routes are not modified. Their STEP 0 gate enforcement
  (`validateApprovalGate`, atomic claim, persisted execution) and STEP 2 rejection/audit
  transaction were verified at the audited heads in the STEP 0 and STEP 2 audits.

**Reason:** decisions go through the existing canonical POST handlers in-process, and the older
independent claim/execute/finish ports no longer exist in this gateway.

## Condition 4 — Literal human confirmation — **PASS**

**Evidence:**
- `src/lib/executive-agent/engine-runtime-contract.ts` — `EngineRequest` defines approve and
  reject as `z.object({ operation: z.literal("approve"), requestId: z.string().uuid(),
  humanConfirmed: z.literal(true) })` (and the same for `"reject"`). `z.literal(true)` accepts
  **only** the literal boolean `true`; `false`, `"true"`, `1`, `null`, or an omitted field all
  fail zod validation and the route returns 400.
- `tests/engine-integration/gateway.test.mjs`, test "literal confirmation and stored action
  cannot be forged": for `humanConfirmed` of `[false, 'true', 1, null]`, each decide returns
  400.
- `src/app/api/admin/executive-agent/engine-runtime/route.ts` — the `decide` callback passes
  `{humanConfirmed}` in the body to the canonical handler, which enforces
  `humanConfirmed === true` (STEP 0 audit).
- `src/lib/executive-agent/engine-runtime.spec.ts`, test "unknown fields, missing confirmation,
  mismatched IDs and revoked ownership fail": an approve with no `humanConfirmed` is rejected.

**Reason:** only a literal `true` is accepted at both the gateway schema and the canonical gate;
every other value or an omission is refused.

## Condition 5 — Persisted action/payload — **PASS**

**Evidence:**
- `src/lib/executive-agent/engine-runtime-core.ts` — the `propose` operation calls
  `ports.create(request.requestId, engine.id, expected.action, expected.payload, input)`, which
  in the service is `insertExecutiveApproval` with `targetType: "engine:"+engineId`,
  `proposedAction`, and `payloadJson`. The store hardcodes `status: "pending"` (verified in the
  STEP 0/STEP 2 audits). No execution happens on propose — the spec test asserts `runs()` is 0
  after propose, and the gateway test asserts `executions.length` is 0 after propose.
- The approve path re-reads the row (`ports.get(request.requestId)`), then validates the stored
  action/payload with `sameEngineProposal(row, engine.id, input)` — which recomputes the expected
  action and payload from the stored row and compares them (stable JSON comparison) — and throws
  409 `'Stored engine proposal is inconsistent.'` on mismatch, before any execution.
- The canonical approve handler locks the stored row and dispatches the stored action/payload
  (STEP 0 audit); the gateway never passes a caller-supplied payload to the executor.
- `src/lib/executive-agent/engine-runtime.spec.ts`, test "a descriptor cannot replace the stored
  executor or turn an intake into a product": after tampering with the stored `proposedAction`
  to `'createSpecializedAgent'`, approve is rejected and `runs()` stays 0. The same test asserts
  `writeActionForEngine('stephon.intake', …)` maps to `createSiteBuilderTask` (an intake note,
  not a website build).

**Reason:** the action and payload are persisted as a pending approval row before any execution,
and execution reads and re-validates the stored row rather than trusting a caller-supplied
payload.

## Condition 6 — Replay does not dispatch twice — **PASS**

**Evidence:**
- The approve path goes through the canonical handler's atomic claim (compare-and-set) and
  terminal-state checks (STEP 0 audit). The core's comment states: "The canonical route owns
  gate validation, atomic claim, execution and final status. Even repeated decisions go through
  that gate; only receipt reads are idempotent."
- `src/lib/executive-agent/engine-runtime.spec.ts`, test "proposal is durable and idempotent;
  concurrent approvals execute once": 4 concurrent approves, exactly 1 fulfills, `runs()` is 1,
  status is `executed`; a subsequent approve is rejected and `runs()` stays 1.
- Same file, test "read calls do not queue or execute and an uncertain execution is never
  replayed": after a lost response, the row stays `approved`, a second approve is rejected, and
  the decide-call count stays 1.
- Same file, test "rejection is terminal and cannot be changed into an execution": after a
  reject, approve is rejected, status stays `rejected`, and `runs()` stays 0.
- `tests/engine-integration/gateway.test.mjs`, test "proposal idempotence plus canonical approve
  handler executes one persisted action": 4 concurrent decides, exactly 1 returns 200,
  `executions.length` is 1, and the audit log shows `approval_refused` for the others.
- Same file, test "lost execution response retains claimed state and never auto-executes twice":
  after a lost response (500), the row stays `approved`, a second decide returns 409, and
  `executions.length` stays 1.
- Same file, test "canonical reject handler updates shared queue and audits once; approve cannot
  revive it": after a reject (200, status `rejected`, `approval_rejected` audit), a subsequent
  approve returns 409 and `executions.length` stays 0.

**Reason:** the canonical gate's atomic claim and terminal-state checks make a replayed or
concurrent approve conflict instead of executing again, and a lost response is never
automatically retried.

## Condition 7 — Inbox read does not send — **PASS**

**Evidence:**
- `src/lib/executive-agent/engine-runtime-service.ts` — the `read` switch, case
  `"executive.inbox"`: it calls only `listDepartmentMessagesForExecutiveAdmin(db, 120)` and
  `listApprovedMarketplaceUsers(db, 2500)`, and returns `{messages, recipients, limits:
  {messages: 120, recipients: 2500}, notice: "Executive Inbox records only; no outbound send or
  external email access."}`.
- The inbox store (`src/lib/executive-agent/executive-department-inbox-store.ts`, read at the
  head SHA) confirms both functions are SELECT-only:
  `listDepartmentMessagesForExecutiveAdmin(db, limit = 120)` is a `select()` from
  `executiveDepartmentMessages` ordered by `createdAt` desc with a limit clamped to max 300;
  `listApprovedMarketplaceUsers(db, limit = 500)` is a `select()` from `marketplaceUsers` where
  `isApproved = true AND isActive = true`, ordered by username. The store also contains insert
  functions (`insertUserToExecutiveMessage`, `insertExecutiveBroadcast`,
  `insertExecutiveToUserMessage`), but the gateway's inbox read never calls any of them.
- The catalog entry for `executive.inbox` has mode `"read"` and purpose `"Read the latest 120
  Executive Inbox messages and up to 2500 approved active recipients. This does not send a
  message or read external email."`
- The core enforces read-only dispatch: for a `read` operation, if `engine.mode !== 'read'` it
  throws `'Execution requires a reviewed proposal.'`
- `tests/engine-integration/gateway.test.mjs`, test "inbox read uses existing bounded reads and
  never proposes or executes": asserts `inboxLimits` is `[120, 2500]`, `rows.size` is 0, and
  `executions.length` is 0.
- Same file, test "read-only adapters reject proposals and intake continues to mean a brief":
  proposing `executive.inbox` returns 400.

**Reason:** the inbox read path only calls two SELECT-only list functions and returns their
results; it never invokes an insert, send, or publish, and the catalog marks the adapter
read-only.

## Condition 8 — Capability claims match execution evidence — **PASS**

**The 13 adapters, as found in the catalog file**
(`src/lib/executive-agent/engine-runtime-contract.ts`, `ENGINE_CATALOG`):

| # | Engine ID | Mode | Kind |
|---|-----------|------|------|
| 1 | `executive.inbox` | read | Read — latest 120 Executive Inbox messages and up to 2500 approved active recipients; does not send or read external email |
| 2 | `company.accounts` | read | Read — pending and approved account counts; not collected payments |
| 3 | `company.analytics` | read | Read — recorded website analytics and attribution, with source limits |
| 4 | `agents.overview` | read | Read — website agent coordination and capability inventory; routing is not execution |
| 5 | `bentley.outputs` | read | Read — existing owned campaign outputs |
| 6 | `stephon.projects` | read | Read — owned website project status |
| 7 | `eleanor.operations` | read | Read — account-scoped fulfillment operations overview; not an assertion of collected revenue |
| 8 | `jarva.smart_trust` | read | Read — account-scoped Smart Trust fulfillment status; not legal execution or desktop readiness certification |
| 9 | `reality.engagement` | read | Read — recorded engagement summary; no outbound messages |
| 10 | `skipper.knowledge` | read | Read — existing website knowledge-base summary; not proof every document was read |
| 11 | `bentley.market_research` | approval | Proposal-based action — execute the existing Reddit market-sweep pipeline; configured inference may incur provider charges; no publication |
| 12 | `bentley.campaign_drafts` | approval | Proposal-based action — synchronize an owned campaign into unscheduled drafts using the existing executor; no scheduling or publication |
| 13 | `stephon.intake` | approval | Proposal-based action — record an owned client's website brief as an internal intake note; does NOT build a website |

**Count: 10 reads + 3 proposal-based actions = 13 registered adapters.** This matches the PR's
claim exactly.

**Inbox bounds:** the service read switch calls `listDepartmentMessagesForExecutiveAdmin(db, 120)`
and `listApprovedMarketplaceUsers(db, 2500)`. The gateway test asserts `inboxLimits` is
`[120, 2500]`. The claimed bounds (latest 120 messages / up to 2500 approved-active recipients)
match the code. Note: the store's `listDepartmentMessagesForExecutiveAdmin` clamps its limit to
a maximum of 300, so 120 is within bounds; `listApprovedMarketplaceUsers` applies the given
limit directly, so 2500 is honored.

**79 tests:** verified by counting test cases in the files the CI workflow runs:
- `tests/engine-integration/gateway.test.mjs` — **10** `test()` cases (counted by reading the file).
- `src/lib/executive-agent/engine-runtime.spec.ts` — **5** `test()` cases (counted by reading the file).
- `tests/executive-approval/approval-boundary.test.mjs` — **22** tests (verified in the STEP 0 audit).
- `tests/step2/*.test.mjs` — **42** tests (verified in the STEP 2 audit: 30 + 4 + 8).
- **Total: 10 + 5 + 22 + 42 = 79.** The CI workflow
  (`.github/workflows/skipper-engine-integration.yml`) runs exactly these four commands, plus a
  focused `tsc --strict` over the gateway contract/core/spec. The claimed "79 tests passed in CI,
  plus the focused typecheck" matches the test files and the workflow.

**Caveat on the 79 (updated):** the count is verified by reading the test files; the tests were **not executed locally** in this audit (no local checkout/DB). At audit time CI run results could not be independently confirmed (GitHub API 403 on check-runs/statuses). After the audit, the PR body was updated to record CI run 41625281490 **passed**: 10 gateway + 5 coordinator + 22 approval-boundary + 42 STEP 2 cases (**79 passed total, 0 failures/skips**), plus the strict contract/core/spec typecheck, with job logs independently read. That update is as recorded in the PR body, not re-verified here.

**Reason:** the adapter count and kinds, the inbox bounds, and the test count all match the PR's
claims as found in the code, the tests, and the CI workflow.

---

## Blockers

- **None that fail a condition.** All 8 conditions PASS on code reading.

## Not verified (needs live checks — separate acceptance items, not part of this code audit)

- **CI run results:** the 79-test count is verified by counting test cases in the files the CI workflow runs. At audit time whether they pass in CI could not be independently confirmed (GitHub API 403 on check-runs/statuses); the PR body now records CI run 41625281490 passed (79 passed, 0 failures/skips, plus the focused typecheck), with job logs independently read — as recorded in the PR body, not re-verified here.
- **Test execution:** the gateway and spec tests were read and counted, not executed locally in
  this audit (no local checkout/DB). The integration test exercises the real gateway route,
  contract, core, service, and canonical approve/reject routes, but with test doubles for auth,
  persistence, executor/provider transport, read tools, and inbox stores — it is not real SQL.
- **Live website verification:** protected deployed-session check, actual SQL/provider gateway
  execution, and a full Website/Desktop artifact walkthrough were not performed. The delivery
  doc notes PR #19's disposable tests cover the revenue loop, not new gateway live execution.
- **Native Mac testing:** no Mac runtime check was performed.
- **Membership collection verification:** which page, which paylinks, which processor;
  end-to-end reconciliation — still open.
- **Canonical handler behavior is inherited:** the approve/reject gate behavior comes from the
  audited STEP 0/STEP 2 PRs (verified at their heads, unchanged by this PR); the gateway test
  exercises those handlers through fixture doubles for persistence and execution, not real SQL.
- **Provider readiness:** the catalog itself states registered adapters are "not proof of
  provider readiness or completed work." No provider execution was observed in this audit.

## Bottom line

On code compliance alone, **PR #21 satisfies all 8 acceptance conditions** at the reviewed head
`0db3b8c58e3d7414603f4439e1a3ca1e1e2adbcf`. The gateway only dispatches the 13 registered catalog
IDs (10 reads, 3 proposal-based actions), enforces server-side ownership, routes decisions
through the canonical STEP 0/STEP 2 approve/reject handlers with the older independent
claim/execute/finish ports removed, requires a literal `humanConfirmed: true`, persists the
action/payload before execution, cannot double-dispatch on replay, and reads the Executive Inbox
without sending. The remaining acceptance items are live website verification, native Mac testing,
and membership collection verification — none of which can be settled from code reading, and none
of which this audit marks PASS or FAIL. PR #21 stays draft and unmerged; nothing is activated.
