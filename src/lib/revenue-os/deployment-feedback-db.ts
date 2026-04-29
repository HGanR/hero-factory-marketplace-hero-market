/**
 * Queryable deployment feedback storage (revenue_os_deployment_feedback).
 */

import { eq, and, desc, inArray, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  campaignPosts,
  campaigns,
  revenueOsDeploymentFeedback,
  type RevenueOsDeploymentFeedbackRow,
} from "@/lib/db/schema";
import {
  normalizePublishOutcomeToFeedback,
  parseNormalizedDeploymentFeedback,
  type DeploymentFeedbackRowKind,
  type NormalizedDeploymentFeedback,
} from "@/lib/revenue-os/deployment-feedback-contract";
import {
  summarizeDeploymentFeedback,
  feedbackRowKind,
  rowsForMetricAggregation,
  type DeploymentFeedbackRollup,
  coarseEngagementTotal,
  coarseEngagementSplitForSignals,
  totalLeadsReported,
} from "@/lib/revenue-os/deployment-feedback-summary";
import type { DeploymentFeedbackSignalsInput } from "@/lib/revenue-os/derive-system-signals-from-feedback";
import { buildDefaultMetricSyncContext } from "@/lib/revenue-os/platform-evidence-weighting";

export function rowToNormalized(row: RevenueOsDeploymentFeedbackRow): NormalizedDeploymentFeedback | null {
  const n = parseNormalizedDeploymentFeedback(row.feedbackJson);
  if (!n) return null;
  const col = row.feedbackRowKind as string | undefined;
  const kind: DeploymentFeedbackRowKind =
    col === "performance_metrics" || col === "publish_outcome"
      ? col
      : n.feedbackRowKind === "performance_metrics"
        ? "performance_metrics"
        : "publish_outcome";
  return { ...n, feedbackRowKind: kind };
}

export function buildDeploymentFeedbackSignalsInput(
  normalized: NormalizedDeploymentFeedback[]
): DeploymentFeedbackSignalsInput {
  const metricSyncContext = buildDefaultMetricSyncContext();
  const rollup = summarizeDeploymentFeedback(normalized, {
    metricSyncContext,
  });
  const split = coarseEngagementSplitForSignals(normalized, metricSyncContext);
  const publishedPlatforms = new Set<string>();
  for (const f of normalized) {
    if (f.publishStatus === "published" && feedbackRowKind(f) === "publish_outcome") {
      publishedPlatforms.add(f.platform.toLowerCase());
    }
  }
  const metricRows = rowsForMetricAggregation(normalized);
  const anyReportedClicks = metricRows.some((r) => r.clicks != null && r.clicks > 0);
  return {
    publishedCount: rollup.publishedCount,
    failedCount: rollup.failedCount,
    retryScheduledCount: rollup.retryCount,
    hasPerformanceMetrics: rollup.hasPerformanceMetrics,
    publishedPlatforms: publishedPlatforms.size,
    engagementSignalStrength: coarseEngagementTotal(normalized),
    leadCount: totalLeadsReported(normalized),
    bestMeasuredPlatform: rollup.bestMeasuredPlatform,
    bestPublishedPlatform: rollup.bestPublishedPlatform,
    attentionSignalStrength: rollup.attentionSignalStrength,
    measuredEngagementTotal: split.measuredTotal,
    publishOnlyEngagementTotal: split.publishOnlyTotal,
    measuredMetricPostCount: split.measuredMetricPostCount,
    bestAttentionPlatform: rollup.bestAttentionPlatform,
    bestEngagementPlatform: rollup.bestEngagementPlatform,
    comparisonConfidence: rollup.comparisonConfidence,
    anyReportedClicks,
  };
}

export type DeploymentFeedbackAccessSummary = {
  normalized: NormalizedDeploymentFeedback[];
  rollup: DeploymentFeedbackRollup;
  signalsInput: DeploymentFeedbackSignalsInput;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveDeploymentFeedbackForUser(
  db: any,
  userId: string,
  feedback: NormalizedDeploymentFeedback
): Promise<string> {
  const id = crypto.randomUUID();
  const kind: DeploymentFeedbackRowKind = feedback.feedbackRowKind ?? "publish_outcome";
  const fj = { ...feedback, feedbackRowKind: kind };
  const publishedAt = feedback.publishedAt ? new Date(feedback.publishedAt) : null;
  await db.insert(revenueOsDeploymentFeedback).values({
    id,
    userId: String(userId),
    campaignId: feedback.campaignId,
    campaignPostId: feedback.campaignPostId,
    platform: feedback.platform,
    publishStatus: feedback.publishStatus,
    feedbackRowKind: kind,
    feedbackJson: fj,
    publishedAt,
  });
  return id;
}

/**
 * Append-only performance metrics row (does not alter publish outcome history).
 */
export async function upsertDeploymentPerformanceFeedbackForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  feedback: NormalizedDeploymentFeedback
): Promise<string> {
  const src = feedback.source === "manual_import" ? "manual_import" : "platform_sync";
  const row: NormalizedDeploymentFeedback = {
    ...feedback,
    source: src,
    feedbackRowKind: "performance_metrics",
  };
  return saveDeploymentFeedbackForUser(db, userId, row);
}

export async function attachPerformanceFeedbackToCampaignPost(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  feedback: NormalizedDeploymentFeedback
): Promise<string> {
  return upsertDeploymentPerformanceFeedbackForUser(db, userId, {
    ...feedback,
    feedbackRowKind: "performance_metrics",
  });
}

/** Best-effort: never throws to callers (publish path must stay resilient). */
export async function persistPublishOutcomeDeploymentFeedback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  args: {
    userId: string;
    campaignId: string;
    campaignPostId: string;
    platform: string;
    outcome: "published" | "failed" | "retry_scheduled";
    source: "publish_worker" | "manual_publish";
    publishedAt?: Date | null;
    platformPostId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }
): Promise<void> {
  try {
    const n = normalizePublishOutcomeToFeedback({
      campaignPostId: args.campaignPostId,
      campaignId: args.campaignId,
      platform: args.platform,
      outcome: args.outcome,
      source: args.source,
      publishedAt: args.publishedAt ?? null,
      platformPostId: args.platformPostId ?? null,
      errorCode: args.errorCode ?? null,
      errorMessage: args.errorMessage ?? null,
    });
    await saveDeploymentFeedbackForUser(db, args.userId, n);
  } catch (e) {
    console.error("[deployment-feedback] persistPublishOutcomeDeploymentFeedback", e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listDeploymentFeedbackForUser(
  db: any,
  userId: string,
  opts?: { clientId?: string; limit?: number }
): Promise<NormalizedDeploymentFeedback[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200);
  const clientId = opts?.clientId?.trim();

  let rows: RevenueOsDeploymentFeedbackRow[];

  if (clientId !== undefined && clientId !== "") {
    const campRows = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)));
    const ids = campRows.map((c: { id: string }) => c.id);
    if (ids.length === 0) {
      return [];
    }
    rows = await db
      .select()
      .from(revenueOsDeploymentFeedback)
      .where(
        and(
          eq(revenueOsDeploymentFeedback.userId, String(userId)),
          inArray(revenueOsDeploymentFeedback.campaignId, ids)
        )
      )
      .orderBy(desc(revenueOsDeploymentFeedback.createdAt))
      .limit(limit);
  } else {
    rows = await db
      .select()
      .from(revenueOsDeploymentFeedback)
      .where(eq(revenueOsDeploymentFeedback.userId, String(userId)))
      .orderBy(desc(revenueOsDeploymentFeedback.createdAt))
      .limit(limit);
  }

  const out: NormalizedDeploymentFeedback[] = [];
  for (const row of rows) {
    const n = rowToNormalized(row);
    if (n) out.push(n);
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listDeploymentFeedbackForCampaign(
  db: any,
  campaignId: string,
  limit = 80
): Promise<NormalizedDeploymentFeedback[]> {
  const lim = Math.min(Math.max(limit, 1), 200);
  const rows: RevenueOsDeploymentFeedbackRow[] = await db
    .select()
    .from(revenueOsDeploymentFeedback)
    .where(eq(revenueOsDeploymentFeedback.campaignId, campaignId))
    .orderBy(desc(revenueOsDeploymentFeedback.createdAt))
    .limit(lim);

  const out: NormalizedDeploymentFeedback[] = [];
  for (const row of rows) {
    const n = rowToNormalized(row);
    if (n) out.push(n);
  }
  return out;
}

export async function getLatestPerformanceMetricRowForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  opts?: { clientId?: string }
): Promise<NormalizedDeploymentFeedback | null> {
  const clientId = opts?.clientId?.trim();
  let rows: RevenueOsDeploymentFeedbackRow[];

  if (clientId !== undefined && clientId !== "") {
    const campRows = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)));
    const ids = campRows.map((c: { id: string }) => c.id);
    if (ids.length === 0) return null;
    rows = await db
      .select()
      .from(revenueOsDeploymentFeedback)
      .where(
        and(
          eq(revenueOsDeploymentFeedback.userId, String(userId)),
          eq(revenueOsDeploymentFeedback.feedbackRowKind, "performance_metrics"),
          inArray(revenueOsDeploymentFeedback.campaignId, ids)
        )
      )
      .orderBy(desc(revenueOsDeploymentFeedback.createdAt))
      .limit(1);
  } else {
    rows = await db
      .select()
      .from(revenueOsDeploymentFeedback)
      .where(
        and(
          eq(revenueOsDeploymentFeedback.userId, String(userId)),
          eq(revenueOsDeploymentFeedback.feedbackRowKind, "performance_metrics")
        )
      )
      .orderBy(desc(revenueOsDeploymentFeedback.createdAt))
      .limit(1);
  }

  const row = rows[0];
  return row ? rowToNormalized(row) : null;
}

export async function getDeploymentFeedbackSummaryForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  opts?: { clientId?: string; limit?: number }
): Promise<DeploymentFeedbackAccessSummary> {
  const normalized = await listDeploymentFeedbackForUser(db, userId, opts);
  return {
    normalized,
    rollup: summarizeDeploymentFeedback(normalized, {
      metricSyncContext: buildDefaultMetricSyncContext(),
    }),
    signalsInput: buildDeploymentFeedbackSignalsInput(normalized),
  };
}

export async function getDeploymentFeedbackSummaryForCampaign(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  campaignId: string,
  limit?: number
): Promise<DeploymentFeedbackAccessSummary> {
  const normalized = await listDeploymentFeedbackForCampaign(db, campaignId, limit);
  return {
    normalized,
    rollup: summarizeDeploymentFeedback(normalized, {
      metricSyncContext: buildDefaultMetricSyncContext(),
    }),
    signalsInput: buildDeploymentFeedbackSignalsInput(normalized),
  };
}

/** Posted rows vs rows with `platform_post_id` (debug / rollout observability). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function countPostedCampaignPostsRemoteIdStatsForUser(
  db: any,
  userId: string,
  opts?: { clientId?: string }
): Promise<{ posted: number; withRemoteId: number }> {
  const conds = [eq(campaigns.userId, String(userId))];
  const cid = opts?.clientId?.trim();
  if (cid) conds.push(eq(campaigns.clientId, cid));

  const rows = await db
    .select({
      posted: sql<number>`sum(case when ${campaignPosts.status} = 'POSTED' then 1 else 0 end)`,
      withRemoteId: sql<number>`sum(case when ${campaignPosts.status} = 'POSTED' and ${campaignPosts.platformPostId} is not null and length(trim(${campaignPosts.platformPostId})) > 0 then 1 else 0 end)`,
    })
    .from(campaignPosts)
    .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
    .where(and(...conds));

  return {
    posted: Number(rows[0]?.posted ?? 0),
    withRemoteId: Number(rows[0]?.withRemoteId ?? 0),
  };
}
