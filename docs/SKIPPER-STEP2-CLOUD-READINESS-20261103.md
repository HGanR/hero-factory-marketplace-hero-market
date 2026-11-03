# STEP 2 Cloud schema evidence and application diagnostic

## User-supplied evidence, 2026-11-03

Charles ran read-only SQL in TiDB Cloud SQL Editor against `hero-market` and supplied the outputs in the project conversation. This is user-reported evidence, not an independently executed application query.

All six required tables were present. Full CREATE TABLE definitions were supplied for marketplace_users, entity_onboardings, executive_agent_memory_items, executive_agent_approvals and executive_agent_audit_logs. Column metadata was supplied for platform_activity (not its full index definition). The required account approval/active flags and onboarding submitted/revoked fields exist. The approval status enum includes pending, approved, rejected, executed and failed. Memory and audit storage fields and id primary keys are present. Several payload/summary fields are LONGTEXT rather than the code's TEXT; no incompatible narrowing was observed in those supplied definitions. No schema repair or migration is proposed here.

The SQL editor reported version `8.0.11-TiDB-v8.5.3-serverless`, pessimistic transactions, REPEATABLE-READ, autocommit ON and STRICT_TRANS_TABLES. Session time_zone was SYSTEM; the clock query returned session and UTC time both `2026-11-03 10:38:21` with zero offset. That proves the observed editor session's offset at that time, not the application session or a permanent timezone policy. The schema's AUTO_INCREMENT allocation value is not an account count.

## Remaining gap and change

The website uses `getConnection()` from `src/lib/db/index.ts`, via its existing DATABASE_URL/mysql2 TLS configuration. An editor session does not prove this connection's selected database, session variables or schema visibility.

The new GET `/api/admin/executive-agent/database-readiness` reuses the existing executive-admin cookie authentication and that same connection factory. Authentication precedes diagnostic connection acquisition. Four fixed SELECT/SHOW statements read version, selected database, UTC offset, allowlisted session variables, required column names and id primary keys from metadata. URL/body parameters cannot change SQL. No source account/event records, counts, cursor values, hostnames, usernames, connection URLs or credentials are returned. Wrong database fails without revealing its name. Handler errors return generic codes without exception details. Existing connection factory logging is unchanged.

Responses use private/no-store and Vary: Cookie. It does not SET session/global variables, acquire FOR UPDATE locks, write audit rows, invoke the loop or executors, or register cron. Existing approval gates, charter and business functions are unchanged.

`ok` means only the enumerated metadata/session checks passed. The report always returns `readyForActivation: false`. It does not prove column types/defaults or secondary indexes, driver date decoding, live transaction/concurrency behavior, native Mac operation or membership collections. Disposable SQL evidence in PR #19 remains separate (TiDB 8.5.4 standalone is not this 8.5.3 Cloud deployment).

## Verification and review procedure

Local command: `node --test tests/database-readiness/database-readiness.test.mjs` (Node 24). Tests execute the real diagnostic and actual GET route; only auth/SQL transports are stubbed. Coverage includes unauthorized denial before connection access, route wiring, allowlisted response fields, redacted failures, wrong database, missing columns/composite keys, non-UTC/unknown clock, optimistic mode, missing isolation and non-strict SQL. These are transport-stub tests, not a live Cloud call. A dedicated CI job runs the same tests without dependencies or credentials.

After a separately authorized deployment containing this draft, sign into the intended protected website preview as administrator and open the endpoint in that same origin. Save its JSON result and verify the deployment SHA/environment. Never supply DATABASE_URL, passwords or cookies in chat. A missing route on the current deployment is expected until this code is deployed; a local checkout with deployment credentials is not evidence of the deployed session. A failed check requires inspection; it is not permission to change global settings.

No merge, deployment, cron enablement or production database change is performed by this delivery. Native Mac and membership collection remain open. Audited PR #18, Desktop #16 and Coding Agent #52 are unchanged. This draft is stacked on validation PR #19.
