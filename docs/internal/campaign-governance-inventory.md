# Campaign governance — API & jobs inventory (Governance v1)

Brief index for operators and code navigation. Feature marker: `REVENUE_OS_CAMPAIGN_GOVERNANCE_VERSION` in `campaign-governance-entitlements.ts`.

## Campaign governance routes (authenticated app user unless noted)

| Method | Path | Auth / gate |
|--------|------|-------------|
| GET/PATCH | `/api/campaigns/[id]` | Session; GET via reviewer access; PATCH owner/admin; entitlements on chain + schedule |
| GET/POST | `/api/campaigns/[id]/reviewers` | Owner/admin + `reviewerAssignmentsEnabled` |
| GET | `/api/campaigns/[id]/reviewers/lookup` | Same |
| PATCH/DELETE | `/api/campaigns/[id]/reviewers/[assignmentId]` | Same |
| GET | `/api/campaigns/[id]/reviewer-audit` | Owner/admin (manage auth) |
| GET | `/api/campaigns/[id]/publish-approval-analytics` | Owner/admin + `approvalAnalyticsEnabled` |
| GET | `/api/campaigns/[id]/publish-approval-reviewer-analytics` | Owner/admin + `approvalAnalyticsEnabled` |
| GET | `/api/campaigns/[id]/publish-approval-report` | Owner/admin + `complianceReportExportEnabled` |
| POST | `/api/campaigns/[id]/publish-approval-sla-scan` | Session + campaign access (collaborators OK) |

## Revenue OS helper routes (governance-related)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/revenue-os/publish-approval-settings` | Worker gate + resolved actor (session) |
| GET | `/api/revenue-os/approval-audit-recent` | Current user’s publish-approval audit rows |

## Internal cron / worker routes

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/internal/publish-approval-sla-scan-all` | Cron/worker secret (see `internal-worker-cron-auth`) |
| POST | `/api/internal/publish-approval-report-delivery-run` | Same |
| GET | `/api/internal/job-runs/recent` | Cron secret **or** signed-in admin |

Success responses for the two POST jobs use `buildNormalizedInternalJobResult`: `ok`, `jobType`, `startedAt`, `finishedAt`, `durationMs`, `summary`, optional `errors`, optional `partialFailure`.

## Database migrations (apply in deployment order)

**Drizzle-generated (typical app schema):** under `hero-market/drizzle/` — includes at least:

- `0080_campaign_reviewer_assignments.sql`
- `0081_campaign_reviewer_assignments_updated_at.sql`
- `0082_campaign_reviewer_assignment_audit_events.sql`

**Supplemental SQL** under `hero-market/migrations/`:

- `add_publish_approval_report_schedule_json.sql`
- `add_internal_job_runs.sql`

Run your project’s migration runner so both Drizzle history and supplemental files are applied per environment policy.

## Environment variables & secrets

| Name | Purpose |
|------|---------|
| `REVENUE_OS_GOVERNANCE_TIER` | Optional: `starter` \| `standard` \| `enterprise` (default `enterprise`) |
| `BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL` / worker approval gate | Effective approval with UI toggle (see operator doc) |
| `SCHEDULED_PUBLISH_WORKER_SECRET` / `CRON_SECRET` | Internal cron auth (headers per `isAuthorizedInternalCronRequest`) |
| `admin-token` cookie | Admin session (entitlements + elevated routes) |

## Debug surfaces

- URL: `?airos_debug=1` on AI Revenue OS — workflow debug + `AirosDebugSupportSummary` (entitlements, job runs).
- `GET /api/internal/job-runs/recent` — persisted batch runs.

## Stable error JSON (governance HTTP helpers)

See `src/lib/revenue-os/campaign-governance-http-response.ts` and `GOVERNANCE_FEATURE_NOT_AVAILABLE_BODY` in entitlements module. Common `error` codes: `UNAUTHORIZED`, `NOT_FOUND`, `BAD_REQUEST`, `NO_CHANGES`, `VALIDATION_ERROR`, `FORBIDDEN_CAMPAIGN_SETTINGS`, `INTERNAL_ERROR`, plus domain codes (`FORBIDDEN_ANALYTICS`, `FEATURE_NOT_AVAILABLE`, `FORBIDDEN_REVIEWER_MANAGEMENT`, etc.).

## Related docs

- `campaign-governance-operators.md` — day-2 operations
- `campaign-governance-launch-checklist.md` — deploy smoke list
- `campaign-governance-v1-closeout.md` — Part 29 notes & deferred work
