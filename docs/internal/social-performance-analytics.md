# Social performance analytics (Part 38)

**Scope:** Governed Revenue OS posts (`campaign_posts`). This layer is a **related read model** — it does not change approval, UTM governance, or publish source of truth.

## Storage

- **Table:** `campaign_post_analytics_snapshots` (append-only).
- **Columns (conceptual):** `id`, `campaign_post_id`, `provider`, `provider_post_id`, `snapshot_type` (default `platform_lifetime`), `metrics_json` (typed payload version + normalized metrics + platform snapshot), `fetched_at`, `created_at`.
- **Reads:** “Latest” = row with greatest `fetched_at` per post (implemented in code; no mutable “current metrics” row).

## Normalized metrics (`metrics_json.normalized`)

Fields are **omitted when unknown** — we do not invent zeros.

| Field | Meaning |
|--------|---------|
| `impressions`, `reach`, `clicks` | When the provider API exposes them |
| `reactions` | Likes / reactions where mapped from the adapter |
| `comments`, `shares`, `saves`, `videoViews` | When exposed |
| `engagementsTotal` | **Provider-defined composite** when the adapter sets `engagement` — **not comparable across networks** |

**Instagram:** Uses Graph media fields + `/insights` (lifetime where permitted). Impressions may equal reach when Meta omits impressions (documented in `sourceNotes`).

**LinkedIn:** Uses `GET /rest/socialActions/{urn}` — **likes + comments only**; no impressions via this path.

**Facebook (governed publish):** **No metric sync adapter** in this deployment. Rows may still appear if data is imported later; **Refresh metrics** stays disabled until an adapter exists.

## Provider support matrix

| Provider | Live refresh | Remote id source |
|----------|--------------|------------------|
| Instagram | Yes (Graph) | `platform_post_id` = numeric media id after `media_publish` |
| LinkedIn | Yes (REST socialActions) | `platform_post_id` = URN from publish (`X-RestLi-Id` / ugcPost id) |
| Facebook | **No** | N/A for refresh today |

Declared wiring: `platform-performance-adapters.ts` + `platform-performance-adapter-capabilities.ts`.

## APIs

- **`GET /api/social/posts/[id]/analytics`** — `analytics` object: `availability`, `metricSyncSupport`, `latest`, `recentSnapshots` (newest-first, capped).
- **`POST /api/social/posts/[id]/analytics/refresh`** — On success: `{ ok: true, snapshot, analytics }`. Business failures often return **HTTP 200** with `{ ok: false, code, message }` (e.g. not published, unsupported provider); **404** when the post is missing for the caller’s scope.

## Audit

- **`governed_post_analytics_refresh_failed`** on `campaign_audit_events` when a refresh attempt returns a **fetch error** (not for “unsupported” or validation skips — avoids noise).
- Timeline maps this to **`analytics_refresh_failed`** in `social-publish-observability.ts`.

## UI

- **Planner row:** `analyticsSummaryLine` for **POSTED** rows only (compact; omitted when N/A).
- **Detail:** **Post performance** with **Refresh metrics** when `metricSyncSupport === "live"` and remote id exists; shows `sourceNotes` and `comparatorCaveat`.

## Tests

- `governed-post-analytics-normalize.spec.ts`, `governed-post-analytics-public.spec.ts`, `governed-post-analytics-refresh.spec.ts`
- `src/app/api/social/posts/[id]/analytics/route.spec.ts`
- `governed-post-analytics-aggregate.spec.ts`, `src/app/api/social/campaign-analytics/route.spec.ts`
- `governed-post-analytics-batch-refresh.spec.ts`, `src/app/api/social/campaign-analytics/refresh/route.spec.ts`
- `run-scheduled-governed-post-analytics-refresh.spec.ts`, `governed-post-analytics-refresh-failure-policy.spec.ts`, `src/app/api/internal/social/governed-post-analytics-scheduled-refresh/route.spec.ts`
- Paid social drafts (separate read model from post analytics): see [`paid-social-campaigns.md`](./paid-social-campaigns.md).

## Part 44 — campaign / provider rollups (latest snapshot only)

**Read layer:** `src/lib/social/governed-post-analytics-aggregate.ts` aggregates **one row per published governed post** — the **latest** snapshot per `campaign_post_id` by **`fetched_at DESC`**, with **`id DESC`** tie-break (same rule as `getLatestAnalyticsSnapshotRowsForPostIds`; Part 56). Historical rows are never summed twice.

**Scope:** Posts in `campaign_posts` whose platform normalizes to a **governed** network (LinkedIn, Facebook Page, Instagram Business). Drafts/scheduled rows appear only in **`governedPostCount`**; **`publishedPostCount`** is `status === POSTED` only.

**Metrics:** Sums `metrics_json.normalized` fields when finite (`impressions`, `reach`, `clicks`, `reactions`, `comments`, `shares`, `saves`, `videoViews`, `engagementsTotal`). Each total includes a **post count** of how many latest snapshots contributed that field (omitted fields were null/unknown — not treated as zero).

**Coverage metadata:** Distinguishes **no governed posts**, **no published posts**, **published but never synced** (live adapter + remote id, no snapshot), **unsupported-only** (e.g. only Facebook when no metric adapter), **partial** vs **all published synced**. **`postsMissingRemotePostId`** and **`postsUnsupportedForLiveSync`** explain gaps without inventing metrics.

**API:** `GET /api/social/campaign-analytics?campaignId=` — Revenue OS gate + `getCampaignReviewerAccess`. Response: `campaignSummary`, `aggregateMetrics`, `providerSummaries[]`, `coverage` (headline + notes), `freshness` (freshest/stalest `fetched_at` among included latest snapshots), `liveAdapterProviders` (deployment capability list).

**UI:** `CampaignPublishingAnalyticsSummary` in the Revenue OS **Publishing planner** when a specific campaign is selected (hidden for “All in client”). Compact campaign totals, per-provider rows (sync support label, synced/total, sample metrics), and short comparability caveats. Refreshes when the planner list refresh completes.

**Honesty:** Rollups do **not** imply cross-provider comparability; notes reference provider-specific semantics (see normalized metrics table above). Facebook remains **no live adapter** in this deployment unless capabilities change.

**Performance:** Implementation loads all campaign posts once, then **one** batched latest-per-post snapshot query (`ROW_NUMBER` window; see Part 56) — same strategy as the planner batch hint. A covering index on `(campaign_post_id, fetched_at DESC, id)` may help at very large scale.

## Part 45 — batch analytics refresh (campaign)

**Helper:** `src/lib/social/governed-post-analytics-batch-refresh.ts` orchestrates **sequential** calls to **`refreshGovernedPostAnalytics`** (same insert + normalize path as single-post refresh). No duplicated provider fetch logic.

**Eligibility (attempted refresh):** `POSTED`, governed platform (LinkedIn / Instagram / Facebook row), **`getPlatformMetricSyncSupportState === "live"`**, non-empty **`platform_post_id`**. Anything else is **skipped** (never calls the adapter): unpublished governed posts, non-live providers (e.g. Facebook today), missing remote id, or **deferred** past the batch cap.

**Ordering:** **Oldest `posted_at` first**, tie-break **`created_at`** — documented so operators know stale posts are prioritized.

**Bounds:** Default **25** attempts per request; **`limit`** query/body clamped **1–50** server-side. Eligible posts beyond the cap are counted as **`deferred_due_to_batch_limit`** (skipped, not failed). Synchronous HTTP only — no queue.

**API:** `POST /api/social/campaign-analytics/refresh` — JSON `{ campaignId, limit?: number }`. Response: `attemptedCount`, `succeededCount`, `failedCount`, `skippedCount`, `skippedBreakdown`, `refreshedPostIds`, **`failures`** (capped list of `{ postId, code, message }`), `durationMs`, `finishedAt`. One failure does not abort the batch.

**Audit:** One row per request — **`governed_post_analytics_batch_refreshed`** on **`campaign_audit_events`**, `post_id` null, `platform: governed_social`, details: campaign id, counts, limit, breakdown, duration. **Not** on the per-post activity timeline allow-list (campaign-scoped summary only). Per-post fetch errors still use existing **`governed_post_analytics_refresh_failed`** when applicable.

**UI:** **Refresh campaign analytics** in **`CampaignPublishingAnalyticsSummary`** (disabled when no live adapters). Shows a one-line result; triggers planner refresh callback so rollups and row hints update.

**Honesty:** Skipped ≠ failed. Unsupported providers are **skipped**, not counted as adapter failures.

## Part 46 — scheduled governed analytics refresh (cron)

**Worker:** `src/lib/social/run-scheduled-governed-post-analytics-refresh.ts` — loads a **bounded pool** of recent **`POSTED`** rows with non-empty **`platform_post_id`**, filters to governed + **live-adapter-eligible** (same rules as Part 45), loads **latest snapshot `fetched_at` per post**, then **re-sorts** for work priority.

**Prioritization (deterministic):**

1. **Never synced** (no snapshot row) before any post with a snapshot — tie-break **`posted_at` ASC**, then **`created_at` ASC**.
2. Among synced posts, **stalest `fetched_at` first** — same tie-breakers.

**Pool caveat:** Rows are initially loaded with **`ORDER BY posted_at DESC`** capped at **`scanPoolLimit`** (default **500**, max **2000**). Only posts in that pool are considered; very old published posts never entering the pool may wait until a larger scan or a manual refresh. Documented tradeoff for bounded scans.

**Execution caps (server-clamped):** Defaults — **`maxPosts` 40** (hard max 200), **`maxPostsPerCampaign` 10** (hard 50), **`maxCampaigns` 25** (hard 200). Deferred rows are counted separately: **`deferredDueToBatchLimit`**, **`deferredDueToCampaignLimit`**, **`deferredDueToMaxCampaigns`** (Part 47 adds **`deferredDueToPerProviderCap`** and **`deferredDueToProviderBackoff`**). Each attempt still calls **`refreshGovernedPostAnalytics`** only (same storage/audit behavior as single-post refresh).

**HTTP trigger:** `POST /api/internal/social/governed-post-analytics-scheduled-refresh` — auth **`isAuthorizedInternalCronRequest`** (`CRON_SECRET` / `SCHEDULED_PUBLISH_WORKER_SECRET`, same headers as other internal jobs). Optional JSON body overrides env defaults — see **Part 47**. **Not** a Revenue OS operator route.

**Audit:** One summary row per run — **`governed_post_analytics_scheduled_refresh_ran`**, `post_id` null, `platform: governed_social`, `details.source: scheduled`, counts, caps, deferrals, `durationMs`. **`userId`** defaults to **`GOVERNED_ANALYTICS_SCHEDULED_USER_ID`** env or **`0`**.

**vs manual Part 45:** Operator batch is **per-campaign**, **oldest published first** (no freshness sort). Scheduled job is **global pool**, **freshness-prioritized**, multi-campaign with per-run caps.

**UI:** Small static hint on **`CampaignPublishingAnalyticsSummary`** pointing operators at the internal route and docs (no last-run query in this part).

## Part 47 — provider-aware throttling, env tuning, ops visibility

**Failure policy:** `src/lib/social/governed-post-analytics-refresh-failure-policy.ts` classifies **`refreshGovernedPostAnalytics`** failures (codes + `fetch_error` message text) into **`throttled`**, **`transient_network`**, **`auth_or_token`**, **`unsupported`**, **`unknown`**. Only **`throttled`** advances a **per-provider throttle streak** in the scheduled worker.

**Per-provider behavior (single run, deterministic):** Walk the same **freshness order** as Part 46. For each post, before calling the adapter:

- Enforce **`maxPerProvider`** attempts per provider (default **20**, hard max **100**).
- If that provider is **paused** after **`throttlePauseAfter`** consecutive **throttled** outcomes (default **2**, clamped **1–30**), skip remaining eligible rows for that provider and count them as **`deferredDueToProviderBackoff`**. A **successful** refresh or a **non-throttle** failure **resets** the streak. Pausing applies only for the rest of **this** run.

**Env-driven limits** (all clamped server-side; body overrides still win after clamp):

| Env var | Role | Default / hard max |
|---------|------|---------------------|
| `SCHEDULED_GOVERNED_ANALYTICS_SCAN_POOL_LIMIT` | Pool size (`ORDER BY posted_at DESC`) | 500 / 2000 |
| `SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS` | Global attempts per run | 40 / 200 |
| `SCHEDULED_GOVERNED_ANALYTICS_MAX_POSTS_PER_CAMPAIGN` | Per distinct campaign | 10 / 50 |
| `SCHEDULED_GOVERNED_ANALYTICS_MAX_CAMPAIGNS` | Max distinct campaigns with ≥1 attempt | 25 / 200 |
| `SCHEDULED_GOVERNED_ANALYTICS_MAX_PER_PROVIDER` | Max attempts per provider per run | 20 / 100 |
| `SCHEDULED_GOVERNED_ANALYTICS_PROVIDER_THROTTLE_PAUSE_AFTER` | Consecutive throttled outcomes before pausing a provider | 2 / 1–30 |

**Run summary (worker return + HTTP `summary`):** `attemptedCount`, `succeededCount`, `failedCount`, `throttledCount`, `skippedInPool` (governance/adapter ineligible in pool), deferral breakdowns above, `campaignsTouched`, `durationMs`, `perProviderSummary` (attempted / succeeded / failed / throttled per platform key), `failureSamples` (capped list with optional `category`), plus applied cap fields (`maxPostsApplied`, …).

**HTTP response shape:** Normalized internal job payload — **`ok`**, **`jobType`**: `governed_post_analytics_scheduled_refresh`, **`startedAt`**, **`finishedAt`**, **`durationMs`**, **`summary`** (metrics above), optional **`partialFailure`** / **`errors`** when `failedCount > 0`. Same pattern as **`publish-approval-sla-scan-all`** / **`publish-run`**.

**Internal job runs:** **`persistInternalJobRun`** writes one row per invocation to **`internal_job_runs`** (Part 26) for ops dashboards / monitoring.

**Provider support:** Throttle classification is **message/status grounded**; only **Instagram** and **LinkedIn** have **live** metric adapters in this deployment — others remain skipped via existing eligibility rules.

**Tests:** `governed-post-analytics-refresh-failure-policy.spec.ts`, scheduled worker + route specs (classification, backoff, env clamp, normalized response).

## Part 50 — paid Meta analytics (separate from post snapshots)

**Scope:** **Launched** paid drafts on **`campaign_paid_social_campaigns`** (provider **`meta_ads`**). Does **not** write to **`campaign_post_analytics_snapshots`**; uses **`campaign_paid_social_analytics_snapshots`** only.

**Append-only:** Each successful insights read with at least one numeric metric inserts one row (`metrics_json`: `{ normalized, raw?, meta? }`). **`meta`** (Part 51) holds **`insightsSource`**, **`metricsCompleteness`**, **`sourceNotes`**, **`usedFallbackInsights`** when ad-level data is empty and ad set/campaign insights were used. **Latest** row by **`fetched_at`** is exposed on the paid campaign API projection (`latestPaidMetrics`, `latestPaidMetricsFetchedAt`, `latestSnapshotMeta`).

**Normalized fields (Meta ad lifetime insights only):** `impressions`, `clicks`, `spendMinor`, `reach`, `cpcMinor`, `cpmMinor`, `ctr` — see **`paid-social-analytics-normalize.ts`**. No fabricated conversions.

**Sync:** Operator **`GET /api/social/paid-campaigns/[id]/sync?campaignId=`** (Revenue OS gate) or optional cron **`POST /api/internal/social/paid-social-meta-sync-scheduled`**. Same feature flag as launch: **`PAID_SOCIAL_META_ADS_EXECUTION_ENABLED`**.

**Relationship to organic rollups:** **`CampaignPublishingAnalyticsSummary`** / **`governed-post-analytics-aggregate`** remain **organic-only**. Paid performance is shown in **`PaidSocialCampaignSection`** (compact block). **`GET /api/social/paid-campaigns?campaignId=`** adds **`paidRollup`** (sum of **latest** paid snapshot per draft only).

## Part 51 — paid Meta sync reliability & operator health

**Failure categories** (for backoff, audits, UI hints): **`throttled`**, **`auth_or_token`**, **`not_found`**, **`transient_network`**, **`partial_data`**, **`unknown`** — see **`paid-social-meta-sync-failure-policy.ts`**.

**Sparse insights:** Ad-level lifetime insights may be empty shortly after launch; sync may use **ad set** or **campaign** insights **only when Meta returns rows** — never fabricated totals. Provenance lives on **`metrics_json.meta`** and **`paidSyncHealth`** in the API projection.

**Scheduled worker:** Mirrors Part 47 patterns — per-account **throttle streak**, **pause for remainder of run**, **`deferredDueToBackoff`** vs hard **failed** counts, env-tunable caps (`SCHEDULED_PAID_META_SYNC_*`). One audit **`paid_social_meta_sync_scheduled_ran`** per run.

**Semantics:** **Launch lifecycle** (draft → launched) ≠ **Meta runtime** (delivery state from effective status) ≠ **sync health** (token, throttle, partial read, metrics pending). Documented in **`paid-social-campaigns.md`**.

## Part 52 — paid Meta sync: persisted backoff + job observability

**Cross-run cooldown:** Table **`paid_social_sync_backoff_state`** stores **`backoff_until`** per **`(provider, account_key)`** so scheduled sync skips Meta calls for that ad account until expiry (see **`paid-social-campaigns.md`**). Distinct from **within-run** **`deferredDueToBackoff`** (throttle streak pause for the rest of a single cron invocation).

**Internal jobs:** **`POST /api/internal/social/paid-social-meta-sync-scheduled`** returns **`buildNormalizedInternalJobResult`** (`jobType`: **`paid_social_meta_sync_scheduled`**, **`summary`**, **`durationMs`**, …) and calls **`persistInternalJobRun`** — same pattern as governed analytics scheduled refresh (Part 47). Inspect via **`GET /api/internal/job-runs/recent`** (cron or admin).

**Structured operator errors:** API projection **`paidStructuredSyncError`** (from **`last_meta_sync_error_json`**) complements organic analytics docs only in the sense of **not mixing** paid metrics with **`campaign_post_analytics_snapshots`**.

**Docs:** [`paid-social-campaigns.md`](./paid-social-campaigns.md) (lifecycle, audits, Part 52 env + fields).

## Part 53 — paid Meta: operator cooldown UI, backoff cleanup, job metrics, signals

**Cooldown visibility:** Paid campaign API payloads include **`syncCooldownActive`** / **`syncCooldownUntil`** / **`syncCooldownReason`** when the Meta execution flag is on — see **`paid-social-campaigns.md`**. This surfaces **persisted** account cooldown (scheduled sync deferral) separately from organic post analytics.

**Internal cleanup:** **`POST /api/internal/social/paid-social-sync-backoff-cleanup`** removes **expired** rows from **`paid_social_sync_backoff_state`** (bounded). Tune with **`PAID_SOCIAL_SYNC_BACKOFF_CLEANUP_LIMIT`**. **`internal_job_runs`**: **`paid_social_sync_backoff_cleanup`**.

**Scheduled paid sync summary:** **`paid_social_meta_sync_scheduled`** job **`summary`** adds **`successCount`**, **`throttledCount`**, **`authErrorCount`**, **`deferredDueToRunBackoff`** (alongside existing deferral counters) for cron dashboards — same table as other internal jobs.

**Optimization signals:** **`paidOptimizationSignals`** on paid campaign projections — simple, latest-snapshot-only hints (spend without clicks, low CTR, zero impressions variants). **Not** mixed into **`campaign_post_analytics_snapshots`**.

**Docs:** [`paid-social-campaigns.md`](./paid-social-campaigns.md) Part 53 (definitions + operator interpretation).

## Part 54 — paid list projection batching + signal tuning

**List API:** **`GET /api/social/paid-campaigns`** batches latest paid snapshot reads and Meta cooldown backoff reads per campaign list (see **`paid-social-campaigns.md`**). Does **not** change **`campaign_post_analytics_snapshots`** schema or organic paths.

**Signals:** Env-tunable CTR / impression / spend thresholds; server-side dedupe reduces overlapping hints. **`paidListSignalsSummary`** on the list response supports compact operator overview.

**Docs:** [`paid-social-campaigns.md`](./paid-social-campaigns.md) Part 54.

## Part 55 — paid list snapshots: latest-per-id correctness

**Change:** Paid list projection no longer relies on a **global row cap** over interleaved snapshot rows. **`getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds`** uses a **window function** so each **`campaign_paid_social_campaign_id`** gets its **actual** latest **`fetched_at`** (tie-break **`id DESC`**).

**Organic (Part 56):** Governed organic latest-per-post batch reads were hardened separately — see **Part 56** below (parity with this paid strategy).

**Ops logging:** Optional **`PAID_SOCIAL_LIST_PROJECTION_LOG`** for one line per list projection (counts + **`durationMs`** — see **`paid-social-campaigns.md`** Part 55).

**Docs:** [`paid-social-campaigns.md`](./paid-social-campaigns.md) Part 55.

## Part 56 — organic latest snapshot: parity with paid (ROW_NUMBER)

**Problem:** **`getLatestAnalyticsSnapshotRowsForPostIds`** (`governed-post-analytics-store.ts`) previously loaded **all** snapshot rows for the requested posts (`WHERE campaign_post_id IN (…)` with **no** window), ordered globally by **`fetched_at` DESC, then picked the first row per post in memory. That is **correct** for ordering but **scales poorly** (large transfers) and used **only `fetched_at`** for ordering — **non-deterministic** when two rows share the same timestamp.

**Fix:** Same pattern as paid Part 55: one query with **`ROW_NUMBER() OVER (PARTITION BY campaign_post_id ORDER BY fetched_at DESC, id DESC)`** and **`rn = 1`**. Surfaces: **`GET /api/social/planner`** (batch hints), **`buildCampaignGovernedSocialAnalyticsAggregate`** / **`GET /api/social/campaign-analytics`**, scheduled governed analytics refresh (latest map for prioritization), and any other caller of **`getLatestAnalyticsSnapshotRowsForPostIds`**.

**Post detail / history:** **`listRecentSnapshotsForPost`** (used for **`GET /api/social/posts/[id]/analytics`** history + “head” latest in the small recent window) now orders by **`fetched_at DESC, id DESC`** so the displayed **latest** among the capped recent list is **deterministic** under equal timestamps.

**Shared helper:** **`rowsFromMysqlExecute`** in **`src/lib/db/mysql-execute-select-rows.ts`** normalizes Drizzle/mysql2 **`db.execute`** SELECT shapes; used by paid and organic snapshot batch queries.

**Ops logging:** Optional **`ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG`** (`1` / `true` / `yes`) — one **`console.log`** line per batch: **`snapshotQueryStrategy`**, **`distinctPostIds`**, **`snapshotRowsReturned`**. Not in JSON API responses.

**Docs:** This file; planner notes in [`publishing-planner-workflow.md`](./publishing-planner-workflow.md).

## Part 57 — indexes, DB compatibility, release hardening

**Indexes (read path):** Migration **`drizzle/0090_analytics_snapshots_latest_read_indexes.sql`** adds:

| Table | Index | Columns (index order) |
|-------|--------|------------------------|
| **`campaign_post_analytics_snapshots`** | **`cp_analytics_latest_per_post_read_idx`** | **`campaign_post_id`**, **`fetched_at` DESC**, **`id` DESC** |
| **`campaign_paid_social_analytics_snapshots`** | **`camp_paid_soc_analytics_latest_per_paid_read_idx`** | **`campaign_paid_social_campaign_id`**, **`fetched_at` DESC**, **`id` DESC** |

These support the **ROW_NUMBER … PARTITION BY … ORDER BY fetched_at DESC, id DESC** batch queries (Parts 55–56) and per-post history reads that sort the same way. Older two-column indexes (**`cp_analytics_post_fetched_idx`**, **`camp_paid_soc_analytics_paid_fetched_idx`**) remain for other lookups.

**DB requirements:** Latest-per-id analytics batch queries require **window functions** (**MySQL 8.0+**, **TiDB** with `ROW_NUMBER`, or equivalent). **Descending indexes** in `0090` require the same generation (MySQL 8+ / recent TiDB). Do not deploy Revenue OS analytics batch paths against **MySQL 5.7** or engines without window functions.

**Deploy:** Run **`npm run db:migrate`** / **`node scripts/run-all-migrations.mjs`** so **`0090_analytics_snapshots_latest_read_indexes.sql`** applies before relying on planner / campaign analytics / paid list performance at scale. See [`campaign-governance-launch-checklist.md`](./campaign-governance-launch-checklist.md).

**Release / CI:** Prefer **`npm run test`** (full Jest in-band suite) before shipping changes under `src/lib/social/*analytics*`, `governed-post-analytics-*`, and `paid-social-analytics-*`. **Part 58:** faster slice **`npm run test:analytics`** (see Part 58 below).

**Debug logging (non-prod):** Keep **`ORGANIC_POST_ANALYTICS_LATEST_BATCH_LOG`** and **`PAID_SOCIAL_LIST_PROJECTION_LOG`** off in production unless diagnosing latency; they only **`console.log`** (see Part 55–56).

**Post-deploy sanity:** For a campaign with multiple analytics refreshes, open **Publishing planner** (per-post hint) and **campaign analytics** rollup — counts should match the **newest** refresh per post, including when two snapshots share a timestamp (higher **`id`** wins).

**Code:** `schema.ts` declares the same index **names** and column order (ascending in Drizzle metadata; **SQL migration** defines **DESC** — operators should treat **`0090`** as authoritative for physical index direction).

## Part 58 — query-plan validation, overlapping indexes, test ergonomics

**EXPLAIN support (non-prod):** Run **`npm run db:explain-analytics-latest`** from `hero-market/` (requires **`DATABASE_URL`**). It executes **`EXPLAIN`** for the organic and paid **ROW_NUMBER** latest-snapshot query shapes only — no writes, not part of the app runtime. Implementation: **`scripts/explain-analytics-latest-snapshot-queries.mjs`**. Copy-paste SQL and post-deploy steps: [`analytics-latest-read-query-plans.md`](./analytics-latest-read-query-plans.md).

**Overlapping indexes:** **`cp_analytics_post_fetched_idx`** / **`camp_paid_soc_analytics_paid_fetched_idx`** (two columns) overlap on the left prefix with the Part 57 triple-column latest-read indexes. **Part 58 does not drop** them — confirm with **`EXPLAIN`** + production metrics before any removal (see runbook table in **`analytics-latest-read-query-plans.md`**).

**Tests:** **`npm run test:analytics`** runs a focused Jest slice (governed + paid snapshot analytics, campaign analytics routes, paid list route spec, post analytics route, schedulers). Prefer **`npm run test`** before full releases.

## Part 59 — Organic promotion signals + cross-surface hints

**Organic signals:** **`deriveOrganicPerformanceSignals`** in **`organic-performance-signals.ts`** reads **latest normalized** metrics from stored snapshots (same shape as **`GET /api/social/posts/:id`** analytics). Returned on post detail as **`organicPromotion`** (`signals`, `candidateForPromotion`). Campaign list rollup for paid UI: **`computeOrganicPromotionOpportunitySummaryForCampaign`** (counts posts meeting thresholds).

**Cross-surface:** When a paid draft’s **`creative_config_json.referenceOrganicPostId`** is set and paid **latest** metrics exist, **`deriveCrossSurfaceAnalyticsSignals`** compares organic vs paid numerically (see **`cross-surface-analytics-signals.ts`**). Documented in **`paid-social-campaigns.md`** Part 59.

**No storage changes** to **`campaign_post_analytics_snapshots`** or paid snapshots — comparisons are computed at read time.

## Later ideas (Part 48+)

- Facebook Page / post insights adapter (honest field mapping).
- Wider pool without full table scan (e.g. indexed “needs refresh” probe or SQL latest-per-post).
