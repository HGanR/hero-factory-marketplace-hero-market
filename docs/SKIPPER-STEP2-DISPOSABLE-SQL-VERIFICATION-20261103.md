# STEP 2 revenue-loop disposable SQL verification

Validation-only follow-up, stacked on audited Website PR #18 head `d81d6b1183668175679b9e2d7b72a771f3075bee`. The production code, charter, schema, deployment configuration and audited PR heads are unchanged by this validation draft. Nothing is activated or deployed.

## What runs

`node tests/revenue-loop/prepare-disposable-db.mjs` creates a new, fixed localhost-only database and test user. An existing database is refused. No application DATABASE_URL, JWT/admin credentials, provider keys or browser session are read. Docker is bound to `127.0.0.1:41306` on isolated GitHub runners. Separate jobs exercise MySQL 8.0 and TiDB 8.5.4 with standalone UniStore. UTC and strict SQL modes are explicit; TiDB transactions are explicitly pessimistic. This is not production TiDB Cloud, distributed TiKV or schema-drift verification.

`node --test tests/revenue-loop/revenue-loop-database.test.mjs` bundles the audited production revenue-loop adapter/core, approval insert and audit writer, merged telemetry query, actual checked-in Drizzle table definitions, and the original pending/approved read functions. The two read-tool bodies are extracted with the TypeScript parser from their real source, unchanged, to avoid loading unrelated engines. Only `getDb()` is bound to the disposable database. `server-only` is a no-op in the test runtime; unused HTTP-wrapper imports are removed. SQL transport, rows, transactions, locking, writes and concurrency are real, not mocks. No action executor/provider is loaded by the coordinator.

Focused fixture DDL uses actual Drizzle column types, defaults, primary/unique constraints and update timestamps for the six touched tables. It is not a production migration rehearsal. For the rollback test only, the disposable audit table temporarily has a shorter toolName limit: proposal audit succeeds, but the final audit fails after the saved checkpoint and snapshot, proving the transaction unwinds those writes too. The original column definition is restored before testing recovery.

## Checks

1. Pending review proposals, durable event receipts/checkpoint, honest unverified-billing snapshot and unchanged source accounts.
2. Same-day retry creates no duplicate proposal/receipt/audit/snapshot.
3. Simultaneous invocations for one owner serialize and propose once.
4. An independent physical connection holds the state row lock; the server process list shows a different connection blocked in the real loop; release allows completion.
5. A real final-audit column violation rolls back proposals, receipts, snapshot and saved cursor; retry recovers once.
6. A fresh connection pool retains deduplication and does not resurrect rejected reviews.
7. Catch-up uses its independent persisted checkpoint and recovers an older event behind the forward cursor.
8. A 250-event same-timestamp group drains through real pagination; catch-up replay creates no duplicate receipts.
9. Source reconciliation finds current pending/submitted-intake reviews with an empty feed; revoked intake is excluded, unpriced intake is not counted as revenue.
10. More than 1,000 source rows refuses without committing a partial checkpoint or reviews.
11. Corrupt checkpoint fails closed, retaining the original value for inspection.
12. One owner's terminal proposal/checkpoint does not suppress another owner's queue.
13. Exactly 1,000 source rows produces 1,000 pending review-only rows and honest null collections; loopback duration is recorded, not presented as a production SLA.

The production 100-page-per-chain budget remains covered by the existing STEP 2 behavioral test; this suite does not load-test a 10,000-event backlog or establish remote/production latency at the 60-second route limit.

## Evidence

Local JavaScript syntax checks passed. Actual database execution is supplied by the new two-engine CI matrix; results will be recorded in the draft PR after completion. Existing `node --test tests/step2/*.test.mjs` also runs in each job. These tests neither enable the cron nor invoke it over a live website session.

Still separate: native Mac, live Website/Desktop walkthrough, membership collection/paylink/processor reconciliation, production database topology/configuration and reviewed scheduled activation. All source PRs remain draft and unmerged, and the loop remains disabled.
