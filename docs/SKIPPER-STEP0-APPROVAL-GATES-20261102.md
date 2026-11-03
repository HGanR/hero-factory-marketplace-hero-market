# STEP 0 approval repair

Scope: STEP 0.1 and 0.2 only. Draft PR; no merge, deployment, migration,
member-auth change, Desktop change or STEP 2 execution.

Pinned baseline: `e26b3dd932fec6b627a5a675725047e381343957` on
`feat/smart-trust-mobile-preview-20261026`. This is deliberately not the
repository's default branch.

## Caller trace before edits

The first PR commit runs full-checkout `git grep` at the pinned baseline.
Run: https://github.com/HGanR/hero-factory-marketplace-hero-market/actions/runs/41578126241

| Symbol | Production definition/callers at baseline |
| --- | --- |
| `executeApprovedTodoFromPayload` | Orchestrator line 519: definition only. No production callers. Three test files mention the name: executor tests, orchestrator safety tests and phase-5 tests. |
| `executeExecutiveApprovedAction` | Executor line 823: definition. Approve route import line 4/call line 29; obsolete orchestrator import line 9/call line 535; automation service import line 8/call line 116. Other matches are tests. |
| `validateApprovalGate` | Gate module definition line 17; automation engine import line 8/call line 117. The approve route did not call it. Other matches are tests. |
| Approve API client | ExecutiveAgentDashboard line 2428; its existing human approval action now submits JSON `humanConfirmed: true`. |

The obsolete helper and its executor/schema imports are removed. Tests that
used its definition as a string boundary now inspect the remainder of the
orchestrator directly, preserving the no-chat-execution assertion.

## Enforcement

The authenticated route delegates to a tested request handler. That handler
loads the persisted approval, calls `validateApprovalGate`, and requires the
owning admin, literal boolean true and pending status before claiming it.
Refusals await an audit insert and never mutate the approval or execute its
action. Foreign payloads are not returned or copied into refusal audits.

Pending-to-approved uses an owner/status compare-and-set. The automation
caller uses the same claim. The shared executor accepts only the identifier
from the caller, re-reads the owner's row under a transaction row lock,
requires stored approved status, and dispatches the stored action/payload.
It finalizes executed/failed status inside that transaction. Terminal rows
cannot replay; synthetic approved objects cannot create a business write.

Infrastructure failures roll back the execution transaction. An approval
claimed before that transaction may remain approved and needs operator
inspection; there is no automatic retry of external operations. SQL
transactions cannot undo a provider side effect or guarantee exactly-once
delivery to an external service during an outage.

## Validation and limits

Run `node --test tests/executive-approval/approval-boundary.test.mjs`.
The tests bundle and run the actual route, gate, approval-store functions,
audit writer, shared dispatcher, payload validator and createTodo executor.
Authentication, SQL transport/schema and unrelated engines are isolated
test doubles. Concurrency tests simulate serialized transactions; they are
not a live MySQL locking test.

Cases include strict confirmation values, ownership, every non-pending
state, malformed JSON, missing rows, audit failure, business-write failure,
concurrent approvals, fabricated IDs/statuses and canonical stored payloads.
The CI workflow also runs existing focused tests, the full `npm test` suite
and `npm run typecheck:tsc`; the PR description records their final results.

Not run: live-admin approval, live MySQL/provider calls, production build,
deployment, migrations or Desktop execution. STEP 1 telemetry and STEP 2
remain separate workstreams. Charles's charter adoption (STEP 0.3) is not
implemented by this patch.
