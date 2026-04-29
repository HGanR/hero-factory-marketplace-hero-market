# Campaign governance — v1 closeout notes (Part 29)

## What shipped in this increment

- **`campaign-governance-inventory.md`** — Routes, migrations, env, debug, error-code pointer.
- **`campaign-governance-launch-checklist.md`** — Deploy-oriented checklist.
- **`campaign-governance-http-response.ts`** — Shared `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`, `NO_CHANGES`, `VALIDATION_ERROR`, `FORBIDDEN_CAMPAIGN_SETTINGS`, `INTERNAL_ERROR` responses on Revenue OS campaign governance surfaces and related internal cron/debug routes.
- **`REVENUE_OS_CAMPAIGN_GOVERNANCE_VERSION`** (`"v1"`) in `campaign-governance-entitlements.ts` — internal marker only.
- **`requireCampaignReviewerAssignmentManageAuth`** — 404 body `error` normalized to `NOT_FOUND` (was `Not found`).
- **Operator doc** updated with cross-links and error-shape summary.

## Cleanup performed

- Replaced ad hoc `"Unauthorized"` / `"Internal server error"` / missing-id strings on the scoped routes with shared helpers where applicable.
- Left intentional domain-specific 403 bodies unchanged (`FORBIDDEN_ANALYTICS`, `FORBIDDEN_REPORT`, `FEATURE_NOT_AVAILABLE`, reviewer management, etc.).

## Intentionally deferred

- **Broad API refactor** outside campaign governance / publish-approval / listed internal routes.
- **Client migration** for old `error` string literals (`"Unauthorized"`) — any external consumer should switch to `UNAUTHORIZED` + `message`.
- **Automated migration ordering** — inventory documents Drizzle vs `migrations/` split; unify only if your release process requires it.
- **Trust / unrelated `governance` APIs** — out of scope for this feature set.

## Follow-up (post–v1)

- Wire `resolveCampaignGovernanceEntitlements` to real billing/plan service.
- Optional OpenAPI snippet for governance endpoints.
- Alerting on `internal_job_runs` `failed` status for SLA/report jobs.
