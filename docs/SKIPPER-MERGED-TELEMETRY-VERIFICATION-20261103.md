# Merged telemetry verification

Pinned integration commit: `0b3e59d2b118529cda283c9cea5e8c8d6ec9c029`.
This validation draft changes no production source, schema, authentication,
deployment configuration or STEP 2 behavior.

## Existing deployed preview

Vercel project: hero-market. The existing automatic Git deployment
`dpl_6TL9FMnhXSStfhvZpqtX8ZD99YjP` is READY and reports the exact pinned
merge SHA and integration branch. This work did not create or promote it.

Preview: https://hero-market-q0em4wd1k-hganrs-projects.vercel.app

The connected Vercel fetch operation for
`/api/admin/executive-agent/telemetry/feed?limit=1` returned
`deployment_authentication_required`, HTTP 401, after its share-link
redirect attempt. It did not return application JSON. No Vercel CLI is
installed in the current workspace for the mapped fallback. This does
not establish whether the request reached application authentication or
the database. Protection settings were not changed.

## Independent database evidence

The CI matrix runs real MySQL 8 and TiDB 8.5.4 in disposable containers bound
only to the runner's loopback address. TiDB uses its standalone UniStore
engine: this verifies SQL/driver behavior, not a distributed production
TiKV cluster, TiDB Cloud configuration or production availability.

The tests bundle the actual merged query, cursor helpers and checked-in
Drizzle schema, and use real mysql2 transport and Drizzle against each
engine. They create an isolated fixture table from the actual schema's
columns/defaults. No SQL pool, predicate builder, rows or transactions are
mocked. The database must start empty. Application DATABASE_URL, JWTs,
cookies, provider keys and application credentials are never read.

Eight tests per engine cover payload/timestamp decoding, final and empty
resume cursors, a 150-row timestamp group, event-type and watermark
filtering, lower UUIDs, real uncommitted/committed visibility across
connections, complete checkpoint replay, empty initial feeds and
read-only behavior. The visibility test injects a deterministic query
clock; it does not wait 50 wall-clock seconds or implement a scheduler.

The existing 20 telemetry tests also run with the repository's actual
dependencies. Results and the exact validation head are recorded in the
draft PR description after CI completes.

Commands, after preparing the disposable CI service:

```sh
node tests/telemetry/prepare-disposable-db.mjs
node --test tests/telemetry/feed-database.test.mjs
node --import tsx --test src/app/api/admin/executive-agent/telemetry/feed/telemetry-feed-route-handler.spec.ts src/lib/telemetry/telemetry-events.spec.ts
```

The workflow provides the explicit test-only opt-in and disposable
credentials. The bootstrap refuses to run outside CI and uses a fixed
localhost port, user and database. Containers are removed after the job.
Fixture creation is not an application migration.

## Remaining signed-in preview check

This remains unverified until authorized access to the existing protected
preview is available:

1. Confirm the application's own administrator sign-in succeeds.
2. Read the feed with the application's session, without creating any
   registration, onboarding or purchase records.
3. Check response shape, event ordering and allowed types, follow a
   returned cursor, and confirm empty polling preserves the cursor.
4. Inspect scoped runtime errors without copying event payloads or
   credentials into a report.

Vercel access and application admin authentication are separate boundaries.
An authorization failure is not evidence that the database query works.
No unauthenticated bypass route or fabricated application session is added.

## Delivery boundary

The feed remains best-effort. A late commit behind a forward cursor can
still be missed by forward-only polling. Scheduling, persisted catch-up
checkpoints, durable deduplication, source-table reconciliation and
downstream actions remain STEP 2 work. These tests do not activate them.

No production merge, migration, deployment, member-state change, provider
call or new paid service is performed by this validation draft.
