# Paired SKIPPER engine gateway integration

## Gap and scope

Coding Agent's website_engine_runtime.py expects `/api/admin/executive-agent/engine-runtime`. That route and its contract/core/service exist on `recovery-from-prod` at `77bed1c090dac758724130e4d803a950ae7581b6` but were absent from the audited STEP 2 line. This draft ports those five gateway files onto diagnostic PR #20 at `bad4cbeaf92a8c3db7640d7a00af4f3ff602b26a`. It is a focused port, not a whole-branch merge or adoption of every recovery-branch change.

The old gateway claimed approvals, executed and finished them itself. This integration removes those ports and calls the existing canonical approve/reject POST handlers in-process, preserving cookie auth, literal confirmation, owner/status gate, atomic claim, executor persisted-row lock and rejection audit transaction. No HTTP self-fetch or alternate dispatcher is added. Repeated decision attempts receive the existing gate's conflict, while receipt reads remain available. An uncertain response is never automatically retried. Wrong-owner engine jobs return not-found without a mutation. The underlying gate's full foreign-owner refusal audit behavior remains covered by the existing approval boundary suite.

The restored twelve adapters remain: nine reads and three proposal-based actions (Bentley market sweep, Bentley campaign drafts, Stephon intake). A thirteenth read adapter, `executive.inbox`, calls the existing latest-120 message and up-to-2500 approved-active-recipient reads. It does not send a message or read external email. The generic paired catalog/planner already accepts registered descriptors, so no Desktop/USB installation change is introduced by this website draft. Actual provider and native readiness still require verification.

No website builder, QR renderer, seal renderer or world/avatar production adapter is claimed added. Stephon intake remains an internal brief. No universal sub-agent product-completion loop is claimed. The revenue cron, enable flag, charter and audited source PR heads are unchanged. No production migration, deployment, provider call or message send is performed.

## Verification

`node --check tests/engine-integration/gateway.test.mjs` passed locally. Local dependency installation is unavailable in this scratch workspace, so executable integration/contract checks run in the dedicated CI workflow; record actual results in the PR before accepting this draft.

Commands:

- `node --test tests/engine-integration/gateway.test.mjs` — real gateway route, contract, core, service, canonical approve/reject routes and gate functions. Only auth, persistence, executor/provider transport, read tools and inbox stores are test doubles. This is not real SQL or a native Mac walkthrough.
- `node --import tsx --test src/lib/executive-agent/engine-runtime.spec.ts` — retained coordinator regression cases updated for canonical decision conflicts.
- `node --test tests/executive-approval/approval-boundary.test.mjs tests/step2/*.test.mjs` — unchanged audited boundaries and STEP 2 behavior.
- Strict tsc over gateway contract/core/spec. Full repository typecheck still has known baseline failures; no clean build is claimed.

Integration cases cover authenticated discovery, unauthenticated/cross-origin denial, bounded read-only inbox, persisted proposal with concurrent/replayed decisions, strict confirmation/payload forgery refusal, non-owner denial, canonical rejection/audit, revoked ownership, uncertain execution response and honest intake semantics.

Remaining: protected deployed-session check, actual SQL/provider gateway execution, native Mac, full Website/Desktop artifact walkthrough and membership collection verification. Existing PR #19 disposable tests cover the revenue loop, not new gateway live execution.

## Parallel work

`docs/SKIPPER-MUSE-PARALLEL-WORK-20261103.md` is the handoff for Charles to give Muse: documentation-only engine coverage audit and actual website/QR adapter specifications. It does not imply a message was sent or work started. Codex owns gateway integration and executable production adapters; Muse can audit and specify without concurrent code edits.
