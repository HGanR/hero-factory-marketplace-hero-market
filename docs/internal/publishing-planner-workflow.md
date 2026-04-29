# Publishing planner & revise/resubmit (Part 31)

Operator-facing workflow for **governed** `campaign_posts` (LinkedIn, **Facebook Page**, **Instagram Business**): planner API, calendar/upcoming UI, edit rules, and resubmit after rejection. **Single approval model** — UTM keys via existing `mergePublishApprovalGovernanceIntoUtm` / worker gate. **Instagram** requires an image/video asset on the post for publish (see [`meta-governed-publishing.md`](./meta-governed-publishing.md)).

## Planner API

- **`GET /api/social/planner?clientId=`** (required) **`&from=`** **`&to=`** (optional ISO dates; default current UTC month) **`&campaignId=`** **`&provider=`** optional **`linkedin`** | **`facebook`** | **`instagram`**
- Returns `{ from, toExclusive, items, groups }` where `items` are normalized `PublishingPlannerItem` rows (see `src/lib/social/publishing-planner.ts`).

## Governed composer (Part 36)

On **AI Revenue OS**, the social publishing panel creates rows via:

- **`POST /api/social/posts`** — body: `provider`, `campaignId`, `accountId`, `content`, optional `scheduledFor`, `linkUrl`, optional `assetId` (must belong to the campaign). Instagram **scheduled** creates require `assetId`.
- **`GET /api/social/posts?campaignId=`** — optional **`provider`** filter; omit to list all governed platforms for the campaign. Each post includes **`assetId`** in the public projection.
- **`GET /api/social/campaign-assets?campaignId=`** — asset picker source (no storage URL in JSON).

Account labels for Meta use **`social-composer-labels`** (`formatComposerSocialAccountLabel`) so Page id / IG–Page relationship is visible when `external_account_id` is present.

## Media & capabilities (Part 37)

- **Capabilities:** `src/lib/social/social-provider-publish-capabilities.ts` — single source for what each provider supports (image/video/text/link/carousel flags).
- **Validation:** `validateComposerSocialPostMedia` on **POST** create and **PATCH** (merged schedule + asset state).
- **Planner rows** join `campaign_assets.creative_type` for blocked reasons **`instagram_requires_media`** and **`provider_media_incompatible`**.
- **Timeline:** PATCH may emit **`asset_changed`** (same audit store as other social patch actions).
- **Campaign assets API:** enriched projection (`mimeType`, dimensions, duration when present in metadata JSON, plus `instagramPublishEligible` / `facebookImageEligible` flags) — still **no** raw storage URLs in JSON.

Full provider matrix: [`meta-governed-publishing.md`](./meta-governed-publishing.md).

## Post detail / PATCH

- **`GET /api/social/posts/[id]`** — `{ post, plannerItem, approvalDetail, publishDetail, activityTimeline, analytics, activityTimelineOrder }` (planner row includes full `content`, readiness, edit capabilities, and Part 32 observability fields; detail objects are stable projections for the side panel).
- **`PATCH /api/social/posts/[id]`** — body may include `content`, `scheduledFor`, `linkUrl`, `accountId`, **`assetId`** (campaign media attachment; material for approval reset), and/or **`resubmitForApproval: true`**. At least one field or `resubmitForApproval` is required.

## States (badges)

| Label | Typical source |
|--------|----------------|
| Draft | `status=DRAFT`, not rejected |
| Pending approval | UTM / effective pending |
| Rejected | Stored `bentley_approval_status=rejected` |
| Approved | Stored approved |
| Scheduled | Row `SCHEDULED` / `RETRY_SCHEDULED` |
| Published / Failed / Publishing | Row terminal states |
| Overdue approval | UI hint: pending & step started &gt; 48h (SLA jobs remain authoritative) |

Multi-step chains show **Step X/Y** on full `SocialPublishingStatusBadge` when `plannerItem` includes chain keys.

## Edit rules (material vs preserve)

**Material fields** (invalidate prior approval when **`BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL`** is on): caption, `linkUrl`, `socialAccountId`, `scheduledAt`, **`assetId`** (linked campaign asset).

- **Draft / failed / retry_scheduled:** edit freely; material changes while **approved** or **pending** with worker gate on → UTM reset to **`pending_approval`** (chain re-seeded from step 0 when a multi-step chain exists).
- **Rejected:** edits keep **rejected** until **`resubmitForApproval: true`** → **`pending_approval`** if worker gate on, else **`not_required`** (clears block for scheduling).
- **Published / publishing:** read-only.
- **Worker gate off:** material edits do **not** force pending; resubmit from rejected still uses **`not_required`** so scheduling is not blocked by approval metadata.

## Revise / resubmit

1. User edits copy/schedule/account while post is **rejected** (optional).
2. User clicks **Resubmit for approval** → `PATCH` with `resubmitForApproval: true` (and any field updates in the same request).
3. Server merges governance UTM; stale/idempotent rules for reviewer PATCH on campaign posts are unchanged (social path does not bypass them).

## Readiness strings

`plannerItem.publishReadiness` and the detail panel explain worker/approval blocking (e.g. “Waiting for approval”, “Rejected — revise and resubmit”, “Scheduled and ready”).

## Part 32 — observability (planner + post detail)

### Planner item fields (`PublishingPlannerItem`)

Additive fields (see `src/lib/social/publishing-planner.ts`) are derived from **`campaign_posts` + UTM** only in list builders (no per-row audit queries):

- **Chain / approval:** `approvalChainSummary`, `approvalCurrentStep` (1-based when in a multi-step pending chain), `approvalCurrentStepLabel`, `approvalCurrentActorLabel`, `approvalLastActionAt`, `approvalLastActionLabel`, `approvalDecisionSummary`, `approvalTimelinePreview` (short strings from UTM timestamps).
- **Publish attempts:** `publishAttemptSummary`, `publishLastAttemptAt`, `publishLastErrorSummary` (from `scheduled_publish_meta` + `error_message`).
- **Diagnostics:** `blockedReason`, `blockedReasonCode` (typed), `overdueSeverity` (`none` | `hint` | `attention`), `diagnostics[]`, `operatorNextActionHint`.

Existing semantics are unchanged: `approvalStatus`, `publishStatusLabel`, `approvalBlocked`, `approvalOverdueHint`, `publishReadiness`, `editCapabilities`.

### Blocked reason codes (`blockedReasonCode`)

Defined in `src/lib/social/social-publish-observability.ts` (`deriveSocialPostBlockedDiagnostics`):

| Code | Meaning |
|------|---------|
| `none` | No primary blocker (secondary notes may still appear). |
| `awaiting_approval` | Scheduled/retry path gated on approval. |
| `approval_overdue` | Pending step older than UI SLA hint (48h; SLA jobs remain authoritative). |
| `rejected_needs_resubmit` | Stored rejection; use PATCH `resubmitForApproval`. |
| `missing_account` | Scheduled without `social_account_id`. |
| `missing_schedule` | Draft with no `scheduled_at`. |
| `missing_content` | Empty caption. |
| `provider_connection_issue` | Stale error text suggests token/auth (heuristic). |
| `publish_failed_retryable` | Row `RETRY_SCHEDULED` (worker will retry). |
| `publish_failed_terminal` | Row `FAILED` (no automatic retry). |
| `published_read_only` | Posted or publishing — not the same as “blocked to publish”; copy is frozen. |

### Post detail API projections

- **`approvalDetail`** — current effective approval status, chain progress labels, pending/approved/rejected timestamps from UTM, `overdueHint`, last action summary.
- **`publishDetail`** — row status, publish label, last attempt/success/failure, `retryable`, `publishBlocked` (worker gate: failed, retry scheduled, or scheduled but approval gate closed).
- **`activityTimeline`** — **newest first** (`activityTimelineOrder: "newest_first"`). Built from `campaign_audit_events` for this `post_id` (filtered actions) plus a synthetic **Post created** anchor from `created_at`. Event kinds include `submitted_for_approval`, `approval_step_advanced`, `approved`, `rejected`, `resubmitted`, `edit_reset_approval`, `content_changed`, `schedule_changed`, `link_changed`, `account_changed`, `publish_attempted`, `published`, `publish_failed`, `retry_scheduled`, `created`, `other`. Labels are formatted in `social-publish-observability.ts` (shared with audit action names from `publish-approval-audit.ts` where applicable).

### Provider scope

- **Provider-agnostic:** UTM approval model, row status, `scheduled_publish_meta`, audit action mapping for worker + manual publish/fail.
- **LinkedIn-specific:** OAuth/account labels and Revenue OS surfaces; core observability helpers stay row-based.

### Tests

- `src/lib/social/social-publish-observability.spec.ts` — blocked reasons, timeline mapping, ordering.
- `src/lib/social/publishing-planner.spec.ts` — observability fields on planner items.
- `src/components/revenue-os/RevenueOsPublishingPlanner.spec.tsx` — detail panel sections.

## Part 33 — PATCH audit coverage (social edits / resubmit)

### What gets written

Successful **`PATCH /api/social/posts/[id]`** inserts rows into **`campaign_audit_events`** when there is something to record. Action names are centralized in **`src/lib/social/social-post-patch-audit.ts`** (`SOCIAL_POST_EDIT_AUDIT_ACTIONS`):

| Action | When |
|--------|------|
| `content_changed` | Caption actually changed (length + preview metadata in `details`, not full body). |
| `schedule_changed` | `scheduledFor` patch resulted in a different `scheduled_at`. |
| `link_changed` | `linkUrl` changed (truncated URLs in `details`). |
| `account_changed` | `social_account_id` changed. |
| `approval_reset_after_edit` | Material edit triggered governance re-seed (`approvalReset && materialChanged`) **and** the request was **not** `resubmitForApproval`. |
| `resubmitted_for_approval` | `resubmitForApproval: true` on a successful PATCH. |

Each row includes `details.source: "social_patch"`, `postId`, `campaignId`, `provider`, actor fields, `previousApprovalStatus`, `nextApprovalStatus`, `approvalReset`, `resubmitForApproval`, and dimension-specific fields.

### Timeline allow-list

`SOCIAL_POST_TIMELINE_AUDIT_ACTIONS` is defined in **`src/lib/social/social-post-audit-query.ts`** (canonical); it unions **`SOCIAL_POST_EDIT_AUDIT_ACTIONS`** with publish-approval and worker/manual publish actions. **`social-publish-observability.ts`** re-exports the same symbols for backward compatibility.

### Anti-duplication rules (same request)

Documented in **`social-post-patch-audit.ts`**:

- **Resubmit** suppresses **`approval_reset_after_edit`** — one clear “Resubmitted for approval” line instead of repeating the same transition.
- **Material reset without resubmit** emits per-field rows **then** a single **`approval_reset_after_edit`** listing which dimensions changed.
- **No separate `approval_status_changed`** from PATCH — reviewer decisions remain on existing `publish_approval_*` audit actions.

Batch rows use monotonic `createdAt` offsets so **newest-first** ordering lists the summary row (resubmit or reset) above field rows when they share a save.

### API

- **`PATCH`** response remains backward compatible; adds optional **`emittedAuditActions`**: string array of actions inserted this request (may be empty).

### Tests

- `src/lib/social/social-post-patch-audit.spec.ts` — planning rules (field-only, reset + fields, resubmit-only, resubmit + edit, empty plan).
- `src/lib/social/social-publish-observability.spec.ts` — timeline labels for PATCH actions and ordering.

## Part 34 — timeline query helper + UI compaction

### Shared audit query (`social-post-audit-query.ts`)

- **`listSocialPostTimelineAuditRows(db, { postId, limit? })`** — single query used by **`GET`** and **`PATCH`** `/api/social/posts/[id]` to load timeline source rows.
- **Columns:** `id`, `action`, `platform`, `details`, `created_at` only.
- **Filter:** `post_id` + `SOCIAL_POST_TIMELINE_AUDIT_ACTIONS` (allow-list).
- **Order:** `created_at` **DESC** (newest first) — matches `SOCIAL_ACTIVITY_TIMELINE_ORDER`.
- **Limits:** `DEFAULT_SOCIAL_POST_TIMELINE_LIMIT` (100), **`MAX_SOCIAL_POST_TIMELINE_LIMIT`** (100); **`clampSocialPostTimelineLimit`** clamps caller input to `[1, max]`.

Timeline **mapping** and synthetic “Post created” remain in **`social-publish-observability.ts`** (no DB in that module).

### UI-only compaction (`social-activity-timeline-ui-compact.ts`)

- **`compactSocialActivityTimelineForDisplay`** merges **consecutive** timeline entries whose `kind` is in the PATCH/edit set (`content_changed`, `schedule_changed`, `link_changed`, `account_changed`, `edit_reset_approval`, `resubmitted`) when adjacent rows are within **2.5s** (`burstWindowMs`) and at least **two** rows qualify.
- **Does not** merge `publish_failed`, `approved`, `created`, etc.
- **API `activityTimeline` is unchanged** — compaction runs only in **`RevenueOsPublishingPlanner`** for display. Full audit fidelity stays in `campaign_audit_events`.

### Tests

- `src/lib/social/social-post-audit-query.spec.ts` — clamp, allow-list, mocked `listSocialPostTimelineAuditRows` chain.
- `src/lib/social/social-activity-timeline-ui-compact.spec.ts` — burst merge, gap separation, isolation from failures.

## Part 38 — post performance analytics

Normalized **read model** for published governed posts: append-only snapshots in **`campaign_post_analytics_snapshots`**, optional planner row hint (`analyticsSummaryLine`), and a **Post performance** block in the planner detail panel.

- **Docs / matrix:** [`social-performance-analytics.md`](./social-performance-analytics.md).
- **Read:** `GET /api/social/posts/[id]/analytics` (same `analytics` envelope is also returned on **`GET /api/social/posts/[id]`**).
- **Refresh:** `POST /api/social/posts/[id]/analytics/refresh` — Revenue OS + campaign reviewer access; calls live adapters only for **Instagram** and **LinkedIn** today.
- **Planner list:** `GET /api/social/planner` batches latest snapshots for **POSTED** rows to populate **`analyticsSummaryLine`** when applicable. **Part 56:** latest-per-post uses the same **ROW_NUMBER / `fetched_at DESC, id DESC`** window strategy as paid list analytics (see [`social-performance-analytics.md`](./social-performance-analytics.md) Part 56) — one SQL round-trip, deterministic ties. **Part 57:** production deploys should apply **`cp_analytics_latest_per_post_read_idx`** (migration **`0090`**) so this batch stays cheap at scale.
- **Part 59 — Promote to ads:** With a **campaign** selected (not “All in client”), open a **POSTED** post → **Post performance** includes **Promote to ads (Meta draft)** → **`POST /api/social/paid-campaigns/from-post`**. Creates a linked paid draft only; operators still complete Meta settings and **Launch to Meta** separately. **`organicPromotion`** hints appear when latest organic metrics cross fixed thresholds. Paid panel shows **Organic promotion hints** when the list API reports **`organicPromotionOpportunitySummary`**. See [`paid-social-campaigns.md`](./paid-social-campaigns.md) Part 59.

## Part 39 — external / client approval surface

Campaign-scoped **reviewer tokens** (hashed in DB) unlock **`/review/social-publish`** and **`/api/external/social-publish-approval/*`**. Approve/reject uses the **same UTM merge and audit actions** as internal workflows; **`campaign_posts`** remains source of truth. Staleness is enforced via **`approvalReviewSnapshot`** on each decision.

- **Full spec:** [`external-social-approval-surface.md`](./external-social-approval-surface.md).
- **Mint / revoke (operators):** `POST /api/social/external-review-tokens`, `POST /api/social/external-review-tokens/[id]/revoke` (Revenue OS + campaign access).
- **Timeline hint:** External decisions show **“(client review link)”** on approved/rejected labels when audit `details.reviewSurface` is `external_social_review`.

## Part 40 — operator client-review link UX

- **Read model:** `GET /api/social/external-review-tokens?campaignId=&postId=` returns token metadata (no secrets), **primary active** token summary, **last external client decision** for the campaign, and optional **postContext** (whether this post is actionable with the primary link).
- **Planner:** `PublishingPlannerItem.hasActiveClientReviewLink` is set on **`GET /api/social/planner`**; pending rows can show a violet **campaign client-link** hint. Detail panel **`ClientReviewLinkOperatorSection`**: mint/copy, expiry selector, post signal, last client decision line.
- **Docs:** [`external-social-approval-surface.md`](./external-social-approval-surface.md).

## Part 41 — token history, per-row revoke, share text, mint/revoke audit

- **UI:** Token history cards (label, roles, status, expiry, `createdByUserId`), per-active-row **Revoke**, **Copy URL** / **Copy message** when the URL exists in-session, mint form **label** + **allowed roles** + **Copy last share message**.
- **API:** Mint accepts **`contextPostId`**; revoke body optional **`contextPostId`** — attaches **`external_review_link_*`** audit rows to that post’s timeline when valid.
- **Docs:** Part 41 in [`external-social-approval-surface.md`](./external-social-approval-surface.md).

## Part 42 — email delivery for client review links

- **`POST /api/social/external-review-link-email`** — mint + **`EmailNotificationService`** send; **`external_review_link_email_sent`** audit when send succeeds.
- **Planner detail:** **Email delivery** — **mailto** draft (known URL) or **Send via server** (always new mint). See Part 42 in [`external-social-approval-surface.md`](./external-social-approval-surface.md).

## Part 43 — bulk revoke + branded HTML for review email

- **`POST /api/social/external-review-tokens/bulk-revoke`** — **`all_active`** or **`all_except_primary`**; optional **`contextPostId`** for timeline attachment; one summary audit **`external_review_links_bulk_revoked`** when anything was revoked (not N× per-token revoke rows).
- **Planner detail:** Campaign-aware bulk revoke buttons under the token list; confirm dialog; same refresh behavior as single revoke.
- **Email:** Server path uses **`buildClientReviewShareEmailHtml`** (plain text from existing helpers remains the content source). **mailto** stays plain text.
- **Docs:** Part 43 in [`external-social-approval-surface.md`](./external-social-approval-surface.md).

## Part 44 — campaign / provider aggregate analytics

- **Read model:** Latest **`campaign_post_analytics_snapshots` row per published governed post** (Part 56: SQL **latest-per-post** window; tie-break **`id DESC`**), summed in **`governed-post-analytics-aggregate.ts`** (no double-count of history).
- **API:** **`GET /api/social/campaign-analytics?campaignId=`** — same access stack as other social Revenue OS routes.
- **Planner:** When a campaign is selected (not “All in client”), **`CampaignPublishingAnalyticsSummary`** shows published vs synced counts, aggregate impressions/engagements (with contributing post counts), per-provider rows, freshness timestamps, and explicit partial-coverage / comparability notes.
- **Docs:** Part 44 in [`social-performance-analytics.md`](./social-performance-analytics.md).

## Part 45 — batch campaign analytics refresh

- **API:** **`POST /api/social/campaign-analytics/refresh`** — bounded batch over **`refreshGovernedPostAnalytics`**; see Part 45 in [`social-performance-analytics.md`](./social-performance-analytics.md).
- **Planner:** **Refresh campaign analytics** on the campaign summary card; refreshes planner data after completion. Per-post **Refresh metrics** in the detail panel is unchanged.

## Part 46 — scheduled analytics refresh (cron)

- **Internal:** **`POST /api/internal/social/governed-post-analytics-scheduled-refresh`** — freshness-prioritized, globally bounded; same cron secret pattern as **`/api/internal/platform-performance-sync/run`**. See Part 46 in [`social-performance-analytics.md`](./social-performance-analytics.md).
- **Planner:** Optional one-line hint on the campaign analytics summary (route path + docs reference).

## Part 47 — scheduled refresh hardening

- **Behavior:** Per-provider attempt caps, consecutive-throttle pause for the rest of the run, env-tunable limits, normalized HTTP + **`internal_job_runs`** persistence (same pattern as SLA scan). See Part 47 in [`social-performance-analytics.md`](./social-performance-analytics.md).
- **Planner:** Hint mentions provider-aware throttling/backoff (no settings UI).

## Part 48 — paid social campaign scaffolding

- **Storage:** `campaign_paid_social_campaigns` — Meta-ads–oriented **drafts** (objective, budget, placements, audience JSON, creative links to `campaign_assets` / optional `campaign_posts` reference). **No live ad launch** in-product yet.
- **API:** `GET/POST /api/social/paid-campaigns`, `GET/PATCH /api/social/paid-campaigns/[id]` — Revenue OS + campaign access gated.
- **Planner:** **`PaidSocialCampaignSection`** when a campaign is selected — readiness mirrors organic-style diagnostics; Meta launch is **off** until **`PAID_SOCIAL_META_ADS_EXECUTION_ENABLED`** is set (see **`paid-social-campaigns.md`**).
- **Docs:** [`paid-social-campaigns.md`](./paid-social-campaigns.md).

## First-pass limitations

- No drag-and-drop reschedule.
- Planner scope is **month (UTC)** + optional campaign filter; “Upcoming” is a client-side slice.
- `datetime-local` in the browser is local time; API stores UTC.
