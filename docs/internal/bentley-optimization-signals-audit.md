# Bentley optimization — available performance signals (audit)

Concise map of **real** signals Bentley can consume today. Granularity, freshness, and confidence limits are noted so the optimization model stays honest.

| Signal | Source | Granularity | Freshness | Confidence limits |
|--------|--------|---------------|-----------|-------------------|
| Governed social metrics (impressions, reach, clicks, reactions, comments, shares, saves, videoViews, engagementsTotal) | `campaign_post_analytics_snapshots` → latest row per `campaign_post_id` (`fetched_at` / `id` ordering) via `buildCampaignGovernedSocialAnalyticsAggregate` | **Post-level** inputs, **campaign rollup** outputs | Per snapshot `fetched_at`; “stalest/freshest” in aggregate payload | Fields **omitted when unknown** — never treated as zero. Cross-network sums are **not** apples-to-apples (see internal social-performance doc). |
| Coverage (no posts, none published, none synced, partial, all synced, unsupported-only) | `computeCampaignGovernedSocialAnalyticsRollup` + adapter capability flags | Campaign | Derived at read time | Explains **measurement gaps** vs performance. |
| Post publish status (DRAFT, SCHEDULED, POSTED, FAILED, …) | `campaign_posts.status` | Post | Real-time DB | Reliable for **publish_friction** when `FAILED` > 0. |
| Publish approval backlog / SLA | `computePublishApprovalAnalytics` over `campaign_posts.utmParams` + optional chain JSON | Campaign summary + stalled posts | Real-time | Strong for **approval_friction** when pending/overdue counts are high. |
| Monthly business funnel (traffic, conversion %, AOV, revenue, CAC, LTV) | `revenue_os_monthly_snapshots` (workspace month rows) | **Workspace / month** — not tied to a single post | Month-stamped rows | Optional **hint only** for conversion/AOV; low causal confidence vs a single organic campaign. |
| Paid social performance | `campaign_paid_social_*` / promotion flows | Paid campaigns | Varies | **Not mixed** into the v1 governed-organic rollup; wire explicitly if comparing paid vs organic later. |
| Dashboard charts / plan vs actuals | UI loaders / snapshot APIs | Mixed | Varies | Use for **context**, not as a second hidden metrics pipeline for Bentley v1. |

**Reliable for driving optimization decisions in v1:** governed aggregate + post status counts + approval analytics. Monthly snapshots are optional secondary hints. Paid paths stay separate unless explicitly integrated.
