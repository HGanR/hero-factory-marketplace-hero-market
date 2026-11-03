# Disposable MySQL verification of audited STEP 0

The production source stays exactly as audited in PR #15 at
`3aac45bac1348d1232ef1dca688ade3cf837c78b`. This separate validation
draft adds tests and CI only, stacked on that branch. It does not alter
the audited PR's head, merge anything, deploy, migrate an application
database, or start STEP 2.

## What is real

The suite bundles the actual approval route/handler, strict gate,
approval-store functions, audit writer, shared action dispatcher,
payload validator, createTodo executor, and checked-in Drizzle schemas.
It uses mysql2 and Drizzle against a disposable MySQL 8 InnoDB service.
There is no SQL transport, schema, transaction or locking test double.

Fixture tables derive their column types/defaults from the actual Drizzle
definitions for approvals, audit logs, clients and client notes.
Independent physical connections are asserted. A held row lock blocks
the dispatcher until the holder commits. Concurrent approvals and direct
dispatches must each produce exactly one persisted client note.

Invalid confirmation and foreign ownership leave the persisted approval
unchanged and create real refusal audits. Fabricated approvals cannot
write. Temporary CHECK constraints induce real database failures to verify
failed approvals, fail-closed refusal auditing, and transaction rollback.
An execution-audit failure must roll back the client note while retaining
the already-claimed approved row, confirming the documented inspection
requirement.

## What remains simulated or unproven

The production JWT authentication helper is replaced with an explicit test
request identity. The suite invokes the real POST handler directly; it is
not a deployed HTTP/browser sign-in test. NextResponse uses the standard
Response implementation. Unrelated engines are stubbed and cannot call
providers. createTodo is a real internal business write, not an external
provider side effect.

This does not validate production credentials, TiDB-specific behavior,
schema/migration drift in the deployed database, website sign-in,
external provider behavior, full production build or Desktop execution.
Existing PR #15 test/typecheck results remain separate. Its original
audit verdict applies to its original SHA only.

## Isolation and command

The test refuses to run without `SKIPPER_MYSQL_TEST_ONLY=1`. It ignores
application DATABASE_URL and uses only 127.0.0.1, the fixed
`skipper_test` user and `skipper_step0_ci` database. That database must
start empty. The CI service supplies disposable credentials and vanishes
with the job; application secrets are not supplied.

After starting that disposable service:

```sh
SKIPPER_MYSQL_TEST_ONLY=1 \
SKIPPER_MYSQL_TEST_PASSWORD=disposable-ci-only \
node --test tests/executive-approval/mysql-boundary.test.mjs
```

CI also re-runs the original 22 simulated boundary checks. The draft PR
description records the final run, verified SHA, results and limits.
No production-source files are changed by this validation work.
