/**
 * Normalized deployment feedback for analytics → systemSignals / Bentley.
 */

export type DeploymentFeedbackSource =
  | "publish_worker"
  | "manual_publish"
  | "platform_sync"
  | "manual_import";

/** Legacy UI-oriented status (subset). */
export type DeploymentFeedbackStatus =
  | "draft"
  | "scheduled"
  | "published"
  | "failed"
  | "unknown";

/** Row-level publish outcome / lifecycle in feedback store. */
export type DeploymentPublishOutcomeStatus =
  | "published"
  | "failed"
  | "retry_scheduled"
  | "publishing"
  | "scheduled"
  | "draft";

/** DB `feedback_row_kind` — mirrored in JSON for exports; DB column is authoritative when present. */
export type DeploymentFeedbackRowKind = "publish_outcome" | "performance_metrics";

/**
 * Full normalized payload stored in `revenue_os_deployment_feedback.feedback_json`
 * and returned from access-layer APIs.
 */
export type NormalizedDeploymentFeedback = {
  campaignPostId: string;
  campaignId: string;
  platform: string;
  publishStatus: DeploymentPublishOutcomeStatus;
  publishedAt?: string | null;
  source: DeploymentFeedbackSource;
  platformPostId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  engagement?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  leads?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  recordedAt: string;
  /** When platform metrics were synced (ISO); performance rows only. */
  syncedAt?: string | null;
  /** Canonical platform key for the metrics source (usually matches `platform`). */
  sourcePlatform?: string | null;
  /** When set to performance_metrics, this row must not increment publish/fail counts. */
  feedbackRowKind?: DeploymentFeedbackRowKind;
};

export type DeploymentFeedbackRecord = {
  postId: string;
  platform: string;
  publishedAt?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  engagement?: number | null;
  leads?: number | null;
  status: DeploymentFeedbackStatus;
};

export function normalizePublishOutcomeToFeedback(args: {
  campaignPostId: string;
  campaignId: string;
  platform: string;
  outcome: "published" | "failed" | "retry_scheduled";
  source: DeploymentFeedbackSource;
  publishedAt?: Date | string | null;
  platformPostId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  recordedAt?: Date;
}): NormalizedDeploymentFeedback {
  const at = args.recordedAt ?? new Date();
  const pub =
    args.publishedAt instanceof Date
      ? args.publishedAt.toISOString()
      : args.publishedAt?.trim() || null;
  return {
    campaignPostId: args.campaignPostId,
    campaignId: args.campaignId,
    platform: args.platform,
    publishStatus: args.outcome,
    publishedAt: args.outcome === "published" ? pub : null,
    source: args.source,
    platformPostId: args.platformPostId ?? null,
    errorCode: args.errorCode ?? null,
    errorMessage: args.errorMessage ?? null,
    recordedAt: at.toISOString(),
    feedbackRowKind: "publish_outcome",
  };
}

export function normalizePerformanceSnapshotToFeedback(args: {
  campaignPostId: string;
  campaignId: string;
  platform: string;
  source: "platform_sync" | "manual_import";
  platformPostId?: string | null;
  publishedAt?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  engagement?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  leads?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  /** ISO time from the platform snapshot (stored as syncedAt + recordedAt). */
  syncedAt?: string | null;
  recordedAt?: Date;
}): NormalizedDeploymentFeedback {
  const at = args.recordedAt ?? new Date();
  const rec = at.toISOString();
  const sync = args.syncedAt?.trim() || rec;
  return {
    campaignPostId: args.campaignPostId,
    campaignId: args.campaignId,
    platform: args.platform,
    publishStatus: "published",
    publishedAt: args.publishedAt ?? null,
    source: args.source,
    platformPostId: args.platformPostId ?? null,
    impressions: args.impressions ?? null,
    clicks: args.clicks ?? null,
    engagement: args.engagement ?? null,
    comments: args.comments ?? null,
    shares: args.shares ?? null,
    saves: args.saves ?? null,
    leads: args.leads ?? null,
    ctr: args.ctr ?? null,
    cpc: args.cpc ?? null,
    recordedAt: rec,
    syncedAt: sync,
    sourcePlatform: args.platform,
    feedbackRowKind: "performance_metrics",
  };
}

export function parseNormalizedDeploymentFeedback(raw: unknown): NormalizedDeploymentFeedback | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const campaignPostId = typeof o.campaignPostId === "string" ? o.campaignPostId : "";
  const campaignId = typeof o.campaignId === "string" ? o.campaignId : "";
  const platform = typeof o.platform === "string" ? o.platform : "";
  const publishStatus = o.publishStatus;
  if (!campaignPostId || !campaignId || !platform) return null;
  if (
    publishStatus !== "published" &&
    publishStatus !== "failed" &&
    publishStatus !== "retry_scheduled" &&
    publishStatus !== "publishing" &&
    publishStatus !== "scheduled" &&
    publishStatus !== "draft"
  ) {
    return null;
  }
  const source = o.source;
  if (
    source !== "publish_worker" &&
    source !== "manual_publish" &&
    source !== "platform_sync" &&
    source !== "manual_import"
  ) {
    return null;
  }
  const rk = o.feedbackRowKind;
  const feedbackRowKind: DeploymentFeedbackRowKind | undefined =
    rk === "performance_metrics" || rk === "publish_outcome" ? rk : undefined;

  return {
    campaignPostId,
    campaignId,
    platform,
    publishStatus,
    publishedAt: typeof o.publishedAt === "string" ? o.publishedAt : null,
    source,
    platformPostId: typeof o.platformPostId === "string" ? o.platformPostId : null,
    errorCode: typeof o.errorCode === "string" ? o.errorCode : null,
    errorMessage: typeof o.errorMessage === "string" ? o.errorMessage : null,
    impressions: typeof o.impressions === "number" ? o.impressions : null,
    clicks: typeof o.clicks === "number" ? o.clicks : null,
    engagement: typeof o.engagement === "number" ? o.engagement : null,
    comments: typeof o.comments === "number" ? o.comments : null,
    shares: typeof o.shares === "number" ? o.shares : null,
    saves: typeof o.saves === "number" ? o.saves : null,
    leads: typeof o.leads === "number" ? o.leads : null,
    ctr: typeof o.ctr === "number" ? o.ctr : null,
    cpc: typeof o.cpc === "number" ? o.cpc : null,
    recordedAt: typeof o.recordedAt === "string" ? o.recordedAt : new Date().toISOString(),
    ...(typeof o.syncedAt === "string" || o.syncedAt === null
      ? { syncedAt: typeof o.syncedAt === "string" ? o.syncedAt : null }
      : {}),
    ...(typeof o.sourcePlatform === "string" ? { sourcePlatform: o.sourcePlatform } : {}),
    ...(feedbackRowKind ? { feedbackRowKind } : {}),
  };
}
