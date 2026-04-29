# Campaign governance — launch checklist (Governance v1)

Use after deploy to a new environment or before GA.

## 1. Database

- [ ] Apply all pending **numbered** SQL migrations under **`drizzle/`** via **`npm run db:migrate`** / **`node scripts/run-all-migrations.mjs`** (tracked in **`drizzle_sql_migrations`**). Includes **Part 57** snapshot read indexes: **`0090_analytics_snapshots_latest_read_indexes.sql`** (**`cp_analytics_latest_per_post_read_idx`**, **`camp_paid_soc_analytics_latest_per_paid_read_idx`**) for governed organic + paid latest-snapshot queries (requires **MySQL 8+** / **TiDB** with window functions + descending indexes).
- [ ] Apply all pending **Drizzle** migrations (includes reviewer assignments + assignment audit tables).
- [ ] Apply `migrations/add_publish_approval_report_schedule_json.sql` if not already in schema.
- [ ] Apply `migrations/add_internal_job_runs.sql` for job observability.
- [ ] Apply `migrations/add_campaign_paid_social_campaigns.sql` if using paid social drafts (Part 48).
- [ ] Apply `migrations/add_campaign_paid_social_meta_launch.sql` if enabling Meta paid launch (Part 49).
- [ ] Apply `migrations/add_campaign_paid_social_part50_sync.sql` for paid Meta **sync + analytics snapshots** (Part 50).
- [ ] Apply **`migrations/add_paid_social_sync_backoff_state.sql`** for **cross-run** scheduled paid Meta sync cooldown per ad account (Part 52).

## 2. Environment

- [ ] `SCHEDULED_PUBLISH_WORKER_SECRET` and/or `CRON_SECRET` set for internal POST jobs.
- [ ] Worker approval gate env configured as intended (`BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL` or your canonical name — see operator doc).
- [ ] `REVENUE_OS_GOVERNANCE_TIER` set for non-enterprise commercial tiers (`starter` / `standard`); omit or `enterprise` for full governance features.
- [ ] **Paid Meta launch (optional, Part 49):** leave **`PAID_SOCIAL_META_ADS_EXECUTION_ENABLED`** unset/false in environments where Marketing API calls must not run. When enabling: set to **`1`** / **`true`** / **`yes`**, provide **`META_MARKETING_ACCESS_TOKEN`** (or rely on encrypted Facebook **`social_accounts`** tokens scoped to the campaign owner + client), and confirm operators understand the **v1 subset** (traffic/engagement, single IMAGE URL, PAUSED objects) — see **`paid-social-campaigns.md`**.

## 3. Schedulers

- [ ] **Hourly (or as needed):** `POST /api/internal/publish-approval-sla-scan-all` with valid cron auth headers.
- [ ] **Daily or weekly (UTC):** `POST /api/internal/publish-approval-report-delivery-run` for scheduled report reminders.
- [ ] **Every 15–60 minutes (optional):** `POST /api/internal/social/governed-post-analytics-scheduled-refresh` — governed post analytics freshness (bounded, provider-aware backoff; tune via `SCHEDULED_GOVERNED_ANALYTICS_*` env — see `social-performance-analytics.md` Part 47).
- [ ] **Optional (Parts 50–53):** `POST /api/internal/social/paid-social-meta-sync-scheduled` — bounded Meta readback for **launched** paid drafts with remote ids (same cron auth headers; only runs when **`PAID_SOCIAL_META_ADS_EXECUTION_ENABLED`** is on). Tune caps with **`SCHEDULED_PAID_META_SYNC_*`** (see **`paid-social-campaigns.md`**). Tune **persisted** throttle/auth cooldowns with **`PAID_SOCIAL_SYNC_PERSISTED_THROTTLE_BASE_SEC`**, **`PAID_SOCIAL_SYNC_PERSISTED_THROTTLE_MAX_SEC`**, **`PAID_SOCIAL_SYNC_PERSISTED_AUTH_COOLDOWN_SEC`** (Part 52). Response matches other internal jobs (`jobType`, `summary`, …) and writes **`internal_job_runs`** (Part 53: extra **`summary`** fields **`successCount`**, **`throttledCount`**, **`authErrorCount`**, **`deferredDueToRunBackoff`**).
- [ ] **Optional (Part 53):** `POST /api/internal/social/paid-social-sync-backoff-cleanup` — deletes **expired** rows in **`paid_social_sync_backoff_state`** (same cron auth). Optional body **`{ limit?: number }`**; env **`PAID_SOCIAL_SYNC_BACKOFF_CLEANUP_LIMIT`** (default 500). Keeps the backoff table small without affecting active cooldowns.
- [ ] **Optional (Part 55):** **`PAID_SOCIAL_LIST_PROJECTION_LOG=1`** — structured **`console.log`** for **`GET /api/social/paid-campaigns`** list projection timing/counts (debug/staging only; see **`paid-social-campaigns.md`** Part 55).
- [ ] **Optional (Part 56–57):** **`ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG=1`** — one line per organic latest-snapshot batch (see **`social-performance-analytics.md`**). Use **non-prod** unless investigating planner/campaign analytics latency.
- [ ] **Optional (Part 58):** After **`0090`** applies, run **`npm run db:explain-analytics-latest`** in **staging** (requires **`DATABASE_URL`**) and confirm **`EXPLAIN`** output references the Part 57 latest-read index names where expected — see [`analytics-latest-read-query-plans.md`](./analytics-latest-read-query-plans.md).
- [ ] **Optional (Part 58):** **`npm run test:analytics`** for a fast Jest slice before shipping analytics-touched code (see **`social-performance-analytics.md`** Part 58).

## 4. Smoke tests (manual or scripted)

- [ ] Sign in; open a campaign with posts; **Publish workflow review** loads without console errors.
- [ ] `GET /api/campaigns/<id>` returns `governanceEntitlements` and `governancePlanTierLabel`.
- [ ] Owner: PATCH chain/schedule succeeds when entitled; non-owner gets `FORBIDDEN_CAMPAIGN_SETTINGS`.
- [ ] Reviewer panel: list/add works on standard+ tier; starter tier returns `FEATURE_NOT_AVAILABLE` on reviewer APIs and UI shows plan message.
- [ ] `POST` SLA scan internal job returns JSON with `ok`, `jobType`, `durationMs`, `summary`.
- [ ] Optional: governed analytics scheduled refresh returns the same normalized shape; `GET /api/internal/job-runs/recent` can include `governed_post_analytics_scheduled_refresh`, **`paid_social_meta_sync_scheduled`**, and **`paid_social_sync_backoff_cleanup`** alongside `publish_approval_*` runs.

## 5. Defaults assumption

If `REVENUE_OS_GOVERNANCE_TIER` is unset, entitlements behave as **enterprise** (all governance flags on) for backward compatibility.

## 6. References

- Full route list: `campaign-governance-inventory.md`
- Operations: `campaign-governance-operators.md`
- Paid social Meta execution matrix: `paid-social-campaigns.md`
