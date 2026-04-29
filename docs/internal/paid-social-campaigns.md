# Paid social campaigns (Parts 48–59)

**Scope:** **Draft / planning** records for paid social (ads) tied to **`campaigns`** rows. **Additive:** organic governed posts stay on **`campaign_posts`**; organic analytics stay on **`campaign_post_analytics_snapshots`**; approval / UTM governance is **unchanged**. **Paid** analytics use **`campaign_paid_social_analytics_snapshots`** (separate append-only table).

## Honesty: launch capability

### Part 48 (always)

- CRUD drafts, operator UI, readiness diagnostics, audit on create/update.

### Part 49 — Meta Ads (narrow, feature-flagged)

When **`PAID_SOCIAL_META_ADS_EXECUTION_ENABLED`** is **`1`**, **`true`**, or **`yes`** (case-insensitive):

- **`isPaidSocialProviderLaunchImplemented("meta_ads")`** is **`true`** — a **real but limited** Marketing API path exists (create **PAUSED** campaign → ad set → creative → ad).
- Operators can call **`POST /api/social/paid-campaigns/[id]/launch`** for drafts that pass **v1 readiness** (see matrix below).

When the flag is **off**:

- **`isPaidSocialProviderLaunchImplemented("meta_ads")`** is **`false`**.
- Structurally complete Meta drafts get **`meta_ads_launch_feature_disabled`** in **`launchBlockedReasons`** (not **`provider_not_launchable_yet`** — that code is for **non‑Meta** providers).

### v1 support matrix (Meta only)

| Area | Supported | Not supported (blocked with explicit readiness codes) |
|------|-----------|--------------------------------------------------------|
| Objectives | **`traffic`**, **`engagement`** | awareness, leads, conversions, … → **`unsupported_objective_for_meta_launch`** |
| Creative | Single **IMAGE** **`campaign_assets`** row with a **non-empty `storage_url`** Meta can fetch | Video/carousel/reference-only post → **`unsupported_creative_for_meta_launch`** |
| Placements | At least one of: facebook_feed, instagram_feed, instagram_reels, facebook_reels, instagram_stories, facebook_stories | Empty / unknown → **`unsupported_placements_for_meta_launch`** or structural **`missing_placements`** |
| Budget | As scaffolded (**daily** / **lifetime** + positive minor units) | Same structural rules as Part 48 |
| Ad account / Page | **`meta_ad_account_id`** and **`meta_page_id`** on the draft row | Missing → **`missing_meta_ad_account`**, **`missing_meta_page_id`** |

**Token:** **`META_MARKETING_ACCESS_TOKEN`** (server env) **or** a **Facebook** row in **`social_accounts`** for the campaign owner + client (optional per-draft override: **`meta_facebook_social_account_id`**).

**Relaunch:** If **`remote_meta_campaign_id`** is set or **`meta_launch_status`** is **`launched`**, launch is blocked (**`already_launched`**) to avoid duplicate remote objects.

### Part 50 — Sync, runtime state, paid analytics

Behind the **same** flag **`PAID_SOCIAL_META_ADS_EXECUTION_ENABLED`**:

- **`GET /api/social/paid-campaigns/[id]/sync?campaignId=`** — read back Meta **campaign / ad set / ad** node fields and **lifetime insights** (see Part 51 fallback); update **`meta_runtime_status`**, **`last_meta_status_json`**, **`last_meta_sync_at`**, **`last_meta_sync_error_json`** (partial errors allowed); **append** a row to **`campaign_paid_social_analytics_snapshots`** when insights yield numeric metrics.
- **Launch lifecycle (operator-facing)** is **derived** in the API from **`meta_launch_status`**, remote ids, and structural readiness: **`draft`**, **`ready`**, **`launch_requested`**, **`launched`**, **`launch_failed`** — see **`paid-social-campaign-state.ts`**.
- **Runtime status** (delivery in Meta) is **`active` \| `paused` \| `learning` \| `limited` \| `rejected` \| `unknown`**, mapped from Meta **`effective_status`** / **`status`** strings (best-effort; unknown is safe).
- **Sync health (Part 51)** is **separate** from lifecycle and runtime — compact **`paidSyncHealth`** (`label`, `tone`, `hint`) from **`paid-social-campaign-sync-health.ts`** so operators can tell token/throttle/partial-metrics cases from “not launched yet”.
- **Optional cron:** **`POST /api/internal/social/paid-social-meta-sync-scheduled`** — bounded batch with **Part 47–style** caps plus **Part 52** cross-run account cooldown (see below). **One audit** per run: **`paid_social_meta_sync_scheduled_ran`**. **Ops:** same normalized HTTP payload as other internal jobs + row in **`internal_job_runs`** (`jobType`: **`paid_social_meta_sync_scheduled`**).

**Metrics honesty:** Normalized snapshot fields are **only** what Meta returns on the insights call (**impressions**, **clicks**, **spend** → **`spendMinor`**, **reach**, **cpc** → **`cpcMinor`**, **cpm** → **`cpmMinor`**, **ctr**). **Conversions** are not synthesized in v1.

### Part 51 — Sync reliability, sparse insights, operator signals

**Failure classification:** **`paid-social-meta-sync-failure-policy.ts`** maps API/phase outcomes to **`throttled`**, **`auth_or_token`**, **`not_found`**, **`transient_network`**, **`partial_data`**, **`unknown`**. Used for scheduled backoff, enriched **`last_meta_sync_error_json`** (`hadThrottle`, `hadAuth`, `worstHardCategory`), and audit details on **`paid_social_campaign_synced`** / **`paid_social_campaign_sync_failed`**.

**Sparse ad insights:** If **ad-level** lifetime insights are **empty** (common early after launch) and the ad insights call did **not** fail with **throttle/auth**, sync **falls back** to **ad set** then **campaign** insights **only when those Graph calls return data**. Snapshot **`metrics_json.meta`** records **`insightsSource`** (`ad` \| `adset` \| `campaign`), **`metricsCompleteness`** (`full` \| `partial_early_delivery` \| `none`), **`usedFallbackInsights`**, and **`sourceNotes`** (operator-honest copy). **No invented metrics.**

**Scheduled paid sync env (all clamped server-side):**

| Env var | Role | Default / hard max |
|---------|------|---------------------|
| `SCHEDULED_PAID_META_SYNC_MAX_ITEMS` | Sync attempts per run | 15 / 100 |
| `SCHEDULED_PAID_META_SYNC_SCAN_POOL_LIMIT` | Pool size (`ORDER BY last_meta_sync_at ASC`) | 120 / 500 |
| `SCHEDULED_PAID_META_SYNC_MAX_PER_ACCOUNT` | Max attempts per normalized ad account id | 8 / 50 |
| `SCHEDULED_PAID_META_SYNC_MAX_CAMPAIGNS` | Max distinct governed campaigns touched | 25 / 100 |
| `SCHEDULED_PAID_META_SYNC_THROTTLE_PAUSE_AFTER` | Consecutive throttle outcomes before pausing an account | 2 / 1–30 |

**List API rollup:** **`GET /api/social/paid-campaigns?campaignId=`** includes **`paidRollup`** — sums **latest snapshot per paid draft** only (**not** organic). Omitted numeric fields are not treated as zero.

**Modules:** **`paid-social-scheduled-meta-sync-config.ts`**, **`run-scheduled-paid-social-meta-sync.ts`**, **`paid-social-campaign-paid-rollup.ts`**.

### Part 52 — Cross-run backoff, structured sync errors, scheduled ops visibility

**Within-run vs cross-run backoff**

| Mechanism | Scope | When |
|-----------|--------|------|
| **`deferredDueToBackoff`** | Same cron invocation | After **`throttlePauseAfter`** consecutive **throttled** outcomes for a normalized ad account, remaining pool rows for that account are skipped until the run ends (Part 51). |
| **`deferredDueToPersistedBackoff`** | **Across** cron runs | Rows in **`paid_social_sync_backoff_state`** with **`backoff_until` &gt; now** for `(provider, account_key)`; scheduled worker **does not** call Meta for those drafts (no attempt counted). |

**Table:** **`paid_social_sync_backoff_state`** (`paidSocialSyncBackoffState` in `schema.ts`) — **`provider`** (e.g. `meta_ads`), **`account_key`** (normalized ad account, `act_` stripped), **`backoff_until`**, **`last_failure_category`**, **`consecutive_throttle_count`**, **`last_failure_at`**, timestamps. **Narrow:** no raw API payloads.

**Helpers:** **`paid-social-sync-backoff-state.ts`** — load batch for pool accounts, **`applyPaidMetaSyncAttemptToBackoffState`** after each scheduled attempt (clear on non–total-failure; **auth** → long cooldown; **throttle** on total failure → exponential-style cooldown capped by env).

**Persisted cooldown env (clamped server-side):**

| Env var | Role | Default (approx.) |
|---------|------|-------------------|
| `PAID_SOCIAL_SYNC_PERSISTED_THROTTLE_BASE_SEC` | Base seconds scaled by throttle streak | 600 |
| `PAID_SOCIAL_SYNC_PERSISTED_THROTTLE_MAX_SEC` | Max throttle-derived window | 28800 |
| `PAID_SOCIAL_SYNC_PERSISTED_AUTH_COOLDOWN_SEC` | Window after auth-classified total failure | 7200 |

**Structured sync errors (UI / API):** **`paid-social-sync-error-projection.ts`** maps **`last_meta_sync_error_json`** to **`paidStructuredSyncError`** on **`projectPaidSocialCampaignPublic`**: **`state`** (`auth_blocked` \| `throttled` \| `partial_data` \| `transient_failure` \| `not_found` \| `unknown`), **`label`**, **`tone`**, **`hint`**, **`retryWorthwhile`** (`now` \| `later` \| `unlikely`). **Separate** from **`paidSyncHealth`** (delivery-oriented) and from launch lifecycle. Raw JSON remains available under **Raw sync error** in the UI.

**Scheduled HTTP response (`buildNormalizedInternalJobResult`):** **`summary`** includes **`skipped`**, **`reason`**, pool/attempt/success/fail counts, **`successCount`** (alias of succeeded), **`throttledCount`**, **`authErrorCount`**, **`errors`** (count of bounded worker error strings), **`deferredDueToBackoff`**, **`deferredDueToRunBackoff`** (alias of within-run deferrals), **`deferredDueToPersistedBackoff`**, **`accountsDeferredDueToPersistedBackoff`** (sample keys), **`deferredDueToPerAccount`**, **`deferredDueToMaxCampaigns`**, **`configApplied`**.

### Part 53 — Operator cooldown visibility, backoff cleanup, early optimization signals

**Persisted cooldown in API/UI:** When **`PAID_SOCIAL_META_ADS_EXECUTION_ENABLED`** is on and the draft is **`meta_ads`**, **`projectPaidSocialCampaignPublic`** loads **`paid_social_sync_backoff_state`** for the normalized ad account and adds:

- **`syncCooldownActive`**, **`syncCooldownUntil`** (ISO), **`syncCooldownReason`** (e.g. `throttled`, `auth_or_token` — from **`last_failure_category`**), **`syncCooldownLabel`**, **`syncCooldownHint`**.

Logic is centralized in **`paid-social-sync-cooldown-projection.ts`** (reuses **`isAccountInPersistedCooldown`** — no second copy of backoff rules).

**How operators should read it:** **Cooldown** = scheduled Meta sync for that **ad account** is intentionally skipped until **`syncCooldownUntil`** (after throttle/auth-classified failures). It is **not** the same as **sync health** (delivery/partial metrics) or **structured sync error** (last run classification). Manual **Sync from Meta** may still be used if the UI allows it.

**Backoff cleanup job:** **`run-paid-social-sync-backoff-cleanup.ts`** deletes rows whose **`backoff_until`** is **strictly before** now (bounded batch). **HTTP:** **`POST /api/internal/social/paid-social-sync-backoff-cleanup`** — same cron auth as other internal workers. Optional JSON **`{ limit?: number }`** (clamped to env default **`PAID_SOCIAL_SYNC_BACKOFF_CLEANUP_LIMIT`** default **500**, hard cap **5000**). Response: **`jobType`**: **`paid_social_sync_backoff_cleanup`**, **`summary`**: **`scannedCount`**, **`deletedCount`**, **`limitApplied`**. **`internal_job_runs`** row for ops visibility (no extra **`campaign_audit_events`** row by default).

**Early optimization signals:** **`paid-social-optimization-signals.ts`** inspects **only the latest paid analytics snapshot** (normalized metrics already stored). Explainable codes:

| Code | When |
|------|------|
| **`spend_without_clicks`** | **`spendMinor`** ≥ configured minimum (default **1** minor unit) and **clicks === 0** (Part 54 env) |
| **`low_ctr`** | **impressions** ≥ configured minimum (default **200**) and CTR (field or **clicks / impressions**) **&lt;** configured threshold (default **0.003** fraction) (Part 54 env) |
| **`no_impressions_after_launch`** | After at least one sync, **impressions === 0**, runtime not **active** / **learning** |
| **`active_but_no_delivery`** | Same but runtime **active** or **learning** |

Signals are **hints**, not diagnoses — no invented metrics. Exposed on list/detail paid campaign payloads as **`paidOptimizationSignals[]`** (`code`, `label`, `hint`). Thresholds and dedupe rules are refined in **Part 54** (below).

### Part 54 — List projection scalability, tunable thresholds, signal dedupe

**Batch list projection:** **`GET /api/social/paid-campaigns?campaignId=`** uses **`projectPaidSocialCampaignsPublicForList`** (`paid-social-campaigns.ts`):

- **One** query for **primary asset hints** for all listed drafts (unchanged pattern).
- **One** query for **true latest analytics snapshot per draft** via **`getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds`** (`paid-social-analytics-store.ts`) — **`ROW_NUMBER()` partitioned by **`campaign_paid_social_campaign_id`** (Part 55). The **single-draft** **`GET /api/social/paid-campaigns/[id]`** path uses **`getLatestPaidSocialAnalyticsSnapshot`** (`ORDER BY fetched_at DESC, id DESC LIMIT 1`, Part 57 tie-break).
- **One** query for **persisted backoff** for all normalized Meta ad accounts on the page via **`loadPaidSyncCooldownProjectionsForAccountKeys`** (`paid-social-sync-cooldown-batch.ts` → **`loadPaidSyncBackoffStatesForAccounts`**), then **`projectPaidSyncCooldownFromBackoffRow`** per key (same rules as Part 53).

**Single-draft paths** (create, **`GET [id]`**, PATCH responses) still call **`projectPaidSocialCampaignPublic`** without the batch maps and keep **per-row** snapshot + cooldown reads — acceptable for arity 1.

**List API additive fields:** **`paidListSignalsSummary`**: **`draftCountWithSignals`**, **`topPrioritySignalLabel`** (highest-priority label across drafts after dedupe — priority order **`no_impressions_after_launch`** &lt; **`active_but_no_delivery`** &lt; **`spend_without_clicks`** &lt; **`low_ctr`**). UI shows a compact **List signals** line when both counts and label are present.

**Optimization signal env (clamped server-side):** **`paid-social-optimization-signal-config.ts`**

| Env var | Meaning | Default / clamp |
|---------|---------|------------------|
| **`PAID_SOCIAL_LOW_CTR_THRESHOLD`** | Decimal CTR fraction below which **`low_ctr`** fires when impressions are sufficient | **0.003** / **0.00005–0.5** |
| **`PAID_SOCIAL_LOW_CTR_MIN_IMPRESSIONS`** | Minimum impressions before CTR is evaluated | **200** / **1–1,000,000** |
| **`PAID_SOCIAL_SPEND_WITHOUT_CLICKS_MIN_SPEND_MINOR`** | Minimum **`spendMinor`** (integer minor units) for **`spend_without_clicks`** | **1** / **1–1e9** |

**Signal dedupe (display-only):** **`dedupePaidOptimizationSignals`** in **`paid-social-optimization-signals.ts`**:

- If **`no_impressions_after_launch`** or **`active_but_no_delivery`** is present → drop **`spend_without_clicks`** and **`low_ctr`** (delivery not meaningfully established in the snapshot).
- If **`spend_without_clicks`** remains → drop **`low_ctr`** (clicks are zero; CTR is not a useful separate nudge).

Sorted output uses **`PAID_OPTIMIZATION_SIGNAL_PRIORITY`** for stable ordering.

### Part 55 — Accurate latest snapshot per draft (list path) + optional projection logging

**Problem (Part 54):** The list batch used a single **`ORDER BY fetched_at DESC LIMIT N`** over all snapshots for the requested paid-campaign ids, then took the first row per id in application memory. One draft with a very large snapshot history could push another draft’s true latest row **past the cap** — incorrect metrics for that draft on **`GET /api/social/paid-campaigns`**.

**Fix:** **`getLatestPaidSocialAnalyticsSnapshotsForPaidCampaignIds`** now runs one SQL query using **`ROW_NUMBER() OVER (PARTITION BY campaign_paid_social_campaign_id ORDER BY fetched_at DESC, id DESC)`** and filters **`rn = 1`**, so each paid draft id gets its **true** latest row regardless of how many rows other drafts have. Requires **MySQL 8+** or **TiDB** (or any engine that supports window functions). **`PAID_SNAPSHOT_LIST_BATCH_ROW_LIMIT`** is **deprecated** (no longer used by this helper).

**Part 57:** Supporting index **`camp_paid_soc_analytics_latest_per_paid_read_idx`** on **`(campaign_paid_social_campaign_id, fetched_at DESC, id DESC)`** — see **`drizzle/0090_analytics_snapshots_latest_read_indexes.sql`** and [`social-performance-analytics.md`](./social-performance-analytics.md) Part 57.

**Part 58:** Validate paid latest-batch **`EXPLAIN`** with **`npm run db:explain-analytics-latest`** or the paid snippet in [`analytics-latest-read-query-plans.md`](./analytics-latest-read-query-plans.md). Overlap note: **`camp_paid_soc_analytics_paid_fetched_idx`** vs triple-column latest-read index — do not drop the shorter index without plan evidence (same runbook).

**Observability:** Set **`PAID_SOCIAL_LIST_PROJECTION_LOG`** to **`1`**, **`true`**, or **`yes`** to emit a single structured **`console.log`** line per list projection: **`snapshotQueryStrategy`** (`mysql_row_number_latest_per_paid_campaign_id`), **`paidCampaignCount`**, **`snapshotRowsReturned`**, **`cooldownDistinctAccountKeys`**, **`durationMs`**. Not included in the public JSON response.

**Modules:** **`paid-social-list-projection-log.ts`**, **`mapMysqlRowToPaidSocialAnalyticsSnapshotRow`** / **`mergeLatestPaidSnapshotRowsIntoMap`** (test hooks) in **`paid-social-analytics-store.ts`**.

## Storage

- **Table:** `campaign_paid_social_campaigns` (`campaignPaidSocialCampaigns` in `schema.ts`).
- **Table:** `campaign_paid_social_analytics_snapshots` — append-only paid metrics (`campaignPaidSocialAnalyticsSnapshots`).
- **Migrations:** `migrations/add_campaign_paid_social_campaigns.sql`, `migrations/add_campaign_paid_social_meta_launch.sql`, **`migrations/add_campaign_paid_social_part50_sync.sql`**, **`migrations/add_paid_social_sync_backoff_state.sql`** (Part 52 account cooldown).
- **JSON:** `audience_json`, `placements_json`, `creative_config_json`.
- **Part 49 columns:** `meta_ad_account_id`, `meta_page_id`, `meta_facebook_social_account_id`, `meta_launch_status` (`idle` \| `launching` \| `launched` \| `failed`), `remote_meta_*` ids, `last_launch_error_json`, `launched_at`, `last_meta_sync_at`.
- **Part 50 columns:** `meta_runtime_status`, `last_meta_status_json`, `last_meta_sync_error_json`.

## Domain

- **`src/lib/social/paid-social-meta-execution-flag.ts`** — `PAID_SOCIAL_META_ADS_EXECUTION_ENABLED`, `isMetaAdsLaunchFeatureEnabled()`.
- **`src/lib/social/paid-social-campaign-readiness.ts`** — structural + Meta launch rules, **`metaExecutionOverlay`**.
- **`src/lib/social/paid-social-campaigns.ts`** — Zod DTOs, CRUD, **`projectPaidSocialCampaignPublic`** (async; loads asset hints for readiness).
- **`src/lib/social/paid-social-meta-marketing-api.ts`** — Graph form posts (v21.0).
- **`src/lib/social/paid-social-campaign-launch.ts`** — **`executePaidSocialMetaLaunch`**, audits, status updates.
- **`src/lib/social/paid-social-campaign-state.ts`** — launch lifecycle + runtime mapping + labels.
- **`src/lib/social/paid-social-meta-sync.ts`** — resilient Meta **GET** readback (status + insights + ad set/campaign fallback).
- **`src/lib/social/paid-social-meta-sync-failure-policy.ts`** — classify failures / bundle summary for backoff and audits.
- **`src/lib/social/paid-social-campaign-meta-sync.ts`** — **`syncPaidSocialMetaCampaign`** (DB + snapshot + audit).
- **`src/lib/social/paid-social-campaign-sync-health.ts`** — **`derivePaidSyncHealth`**, **`formatPaidMetaSyncErrorSummary`**.
- **`src/lib/social/paid-social-analytics-normalize.ts`**, **`paid-social-analytics-store.ts`** — paid snapshot shape + insert/latest read + list-batch **latest-per-paid-campaign-id** (Part 55).
- **`src/lib/social/run-scheduled-paid-social-meta-sync.ts`** — scheduled batch driver (within-run + persisted deferrals).
- **`src/lib/social/paid-social-sync-backoff-state.ts`** — DB cooldown read/write for **`meta_ads`** ad accounts.
- **`src/lib/social/paid-social-sync-error-projection.ts`** — **`projectPaidStructuredSyncError`** for operators.
- **`src/lib/social/paid-social-sync-cooldown-projection.ts`** — operator cooldown fields from backoff rows (Part 53).
- **`src/lib/social/paid-social-optimization-signals.ts`** — latest-snapshot optimization hints, dedupe, list summary helper (Parts 53–54).
- **`src/lib/social/paid-social-optimization-signal-config.ts`** — env thresholds for signals (Part 54).
- **`src/lib/social/paid-social-sync-cooldown-batch.ts`** — batch cooldown projection for list path (Part 54).
- **`src/lib/social/run-paid-social-sync-backoff-cleanup.ts`** — expired backoff row cleanup (Part 53).

## Readiness semantics

Structural codes (same as Part 48):

| Code | Meaning |
|------|---------|
| `missing_objective` | Objective not set |
| `missing_budget` | Budget type `none` or missing / non-positive `budget_amount_minor` |
| `missing_destination` | Missing or invalid http(s) destination URL |
| `missing_placements` | No placements selected |
| `missing_creative` | No linked asset id and no reference organic post in creative JSON |

Meta launch overlay codes (in **`launchBlockedReasons`** when applicable):

| Code | Meaning |
|------|---------|
| `meta_ads_launch_feature_disabled` | Server flag off |
| `missing_meta_ad_account` | No ad account on draft |
| `missing_meta_page_id` | No Facebook Page id for creative |
| `unsupported_objective_for_meta_launch` | Outside traffic / engagement |
| `unsupported_creative_for_meta_launch` | Not single IMAGE with public URL |
| `unsupported_placements_for_meta_launch` | Placements not in v1 set |
| `launch_in_progress` | Status `launching` |
| `already_launched` | Remote campaign id or status `launched` |

**Creative linkage:** At least one of **`primaryAssetIds`** or **`referenceOrganicPostId`** for **structure**; **Meta v1 launch** still requires **IMAGE + URL** on the first linked asset.

## APIs (Revenue OS–gated)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/social/paid-campaigns?campaignId=` | List drafts + **`paidRollup`** + **`paidListSignalsSummary`** (Part 54) |
| POST | `/api/social/paid-campaigns` | Create draft |
| GET | `/api/social/paid-campaigns/[id]?campaignId=` | Single draft |
| PATCH | `/api/social/paid-campaigns/[id]` | Update incl. Meta linkage fields |
| POST | `/api/social/paid-campaigns/[id]/launch` | Body `{ campaignId }` — Meta launch (flag + readiness) |
| GET | `/api/social/paid-campaigns/[id]/sync?campaignId=` | Meta readback + snapshot append (flag + remote ids) |

## Audit

**`campaign_audit_events`** (platform **`paid_social`**):

- **`paid_social_campaign_created`** / **`paid_social_campaign_updated`**
- **`paid_social_campaign_launch_requested`**
- **`paid_social_campaign_launched`**
- **`paid_social_campaign_launch_failed`**
- **`paid_social_campaign_synced`** — one row per **manual** successful sync (may include `warningCount` / `phasesWithErrors` when partial; Part 51: `worstHardCategory`, `usedFallbackInsights`, `metricsCompleteness`, `sourceNotes` when relevant).
- **`paid_social_campaign_sync_failed`** — when **no** node data could be read (total failure).
- **`paid_social_meta_sync_scheduled_ran`** — one row per **scheduled** run (pool/attempt/success/fail + **`successCount`**, **`throttledCount`**, **`authErrorCount`**, **`deferredDueToBackoff`**, **`deferredDueToRunBackoff`**, **`deferredDueToPersistedBackoff`**, **`accountsDeferredDueToPersistedBackoff`**, per-account / max-campaigns deferrals, **`configApplied`**).

### Part 59 — Promote organic → paid draft + cross-surface signals

**Goal:** Connect governed **organic** posts to **Meta paid drafts** without changing governance or auto-launching ads.

- **`POST /api/social/paid-campaigns/from-post`** — body **`{ campaignId, postId }`** (both UUIDs). Requires Revenue OS + campaign reviewer access. Only **`POSTED`** **`campaign_posts`** in that campaign. Creates a **`meta_ads`** draft with **`creative_config_json.referenceOrganicPostId`**, optional **`primary_asset_ids`** from the post’s **`asset_id`**, **`destination_url`** from **`link_url`**, and internal name **`Promoted: …`**. **Does not call Meta launch.**
- **Organic performance signals** — **`organic-performance-signals.ts`**: explainable flags (**`high_impressions`**, **`high_engagement`**, **`above_campaign_average`**) from latest normalized organic metrics; drives **`candidateForPromotion`**.
- **Cross-surface signals** — **`cross-surface-analytics-signals.ts`**: when a paid draft references an organic post **and** paid snapshot metrics exist, emits hints such as **`organic_candidate_for_promotion`**, **`organic_outperforming_paid`**, **`paid_underperforming_baseline`**. Side-by-side only — datasets are not merged in storage.
- **List API additive fields:** **`GET /api/social/paid-campaigns?campaignId=`** includes **`organicPromotionOpportunitySummary`** (`topOrganicCandidateCount`, `topSignalLabel`) for operator context.
- **Projection additive fields:** **`referenceCampaignPostId`** (alias of **`creative.referenceOrganicPostId`**), **`paidCreativeSource`** (`organic_post` \| `manual`), **`crossSurfaceSignals`**.
- **Planner:** **Promote to ads (Meta draft)** on published posts (with campaign selected); **`organicPromotion`** on **`GET /api/social/posts/:id`** surfaces the same signal helper for the detail panel.

**Limitations:** Meta-only draft creation path; launch remains **manual** behind readiness + **`POST …/launch`**. Signals use **fixed thresholds** — not ML.

## UI

**`PaidSocialCampaignSection`** — draft editor, readiness, Meta linkage fields, **Launch to Meta (PAUSED)** when **`readiness.launchEligible`**, **Sync from Meta**, **sync health** badge vs **launch lifecycle** vs **Meta runtime**, **structured sync error** strip (**`paidStructuredSyncError`**: label, retry hint, detail) when last sync error JSON is present, **persisted cooldown** strip when **`syncCooldownActive`** (badge **Meta sync paused (cooldown)**, resume time, optional reason line), compact **Early signals** list when **`paidOptimizationSignals`** is non-empty (deduped server-side, Part 54), optional **List signals** summary line from list API (**`paidListSignalsSummary`**), **Part 59** **Organic promotion hints** strip when **`organicPromotionOpportunitySummary`** has candidates, **Organic vs paid** cross-surface list when **`crossSurfaceSignals`** is non-empty, **creative source** line when **`paidCreativeSource === organic_post`**, last sync time, latest snapshot metrics with **level / fallback / early-delivery** copy, collapsible **Raw sync error** JSON, optional **paid rollup** line from list API.

## Tests

- `paid-social-campaign-readiness.spec.ts`
- `paid-social-campaign-state.spec.ts`, `paid-social-analytics-normalize.spec.ts`, `paid-social-meta-sync.spec.ts`
- `paid-social-meta-sync-failure-policy.spec.ts`, `paid-social-scheduled-meta-sync-config.spec.ts`, `paid-social-campaign-sync-health.spec.ts`
- `run-scheduled-paid-social-meta-sync.spec.ts`
- `paid-social-sync-backoff-state.spec.ts`, `paid-social-sync-error-projection.spec.ts`, `paid-social-campaign-paid-rollup.spec.ts`
- `paid-social-sync-cooldown-projection.spec.ts`, `paid-social-optimization-signals.spec.ts`, `paid-social-optimization-signal-config.spec.ts`, `paid-social-campaign-public-part53.spec.ts`
- `paid-social-sync-cooldown-batch.spec.ts`, `paid-social-campaigns-list-projection.spec.ts`
- `paid-social-analytics-store-latest-batch.spec.ts`, `paid-social-list-projection-log.spec.ts`
- `run-paid-social-sync-backoff-cleanup.spec.ts`, `src/app/api/internal/social/paid-social-sync-backoff-cleanup/route.spec.ts`
- `src/app/api/social/paid-campaigns/route.spec.ts`, `src/app/api/social/paid-campaigns/from-post/route.spec.ts`
- `organic-performance-signals.spec.ts`, `cross-surface-analytics-signals.spec.ts`
- `src/app/api/social/paid-campaigns/[id]/route.spec.ts`
- `src/app/api/social/paid-campaigns/[id]/launch/route.spec.ts`
- `src/app/api/social/paid-campaigns/[id]/sync/route.spec.ts`
- `src/app/api/internal/social/paid-social-meta-sync-scheduled/route.spec.ts`
- `PaidSocialCampaignSection.spec.tsx`

## See also

- [`social-performance-analytics.md`](./social-performance-analytics.md)
- [`publishing-planner-workflow.md`](./publishing-planner-workflow.md)
- [`campaign-governance-launch-checklist.md`](./campaign-governance-launch-checklist.md) — cross-check env flags for paid vs organic
