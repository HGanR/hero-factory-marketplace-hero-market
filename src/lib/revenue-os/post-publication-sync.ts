/**
 * Syncs manual or connector-fed metrics onto published queue rows and experiment / feedback trails.
 */

import crypto from "crypto";
import { getDb } from "@/lib/db";
import { bentleyDistributionQueue, contentFeedbackLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getDistributionQueueItemByExternalRef,
  getDistributionQueueItemForUser,
  type DistributionQueueRow,
} from "@/lib/revenue-os/distribution-queue-actions";
import { recordExperimentResult, type ExperimentResultPayload } from "@/lib/revenue-os/experiment-results";

export type PublishedPerformanceMetrics = {
  views?: number | null;
  clicks?: number | null;
  comments?: number | null;
  saves?: number | null;
  shares?: number | null;
  conversions?: number | null;
  leads?: number | null;
  impressions?: number | null;
  negativeSentimentRatio?: number | null;
  qualitativeNotes?: string | null;
};

export type SyncPublishedQueuePerformanceParams = {
  userId: string;
  clientId: string;
  trustId: string;
  queueId?: string;
  externalPostRef?: string;
  metrics: PublishedPerformanceMetrics;
  measuredAt?: Date;
};

function resolveQueueRow(
  params: SyncPublishedQueuePerformanceParams
): Promise<DistributionQueueRow | null> {
  if (params.queueId?.trim()) {
    return getDistributionQueueItemForUser({
      userId: params.userId,
      clientId: params.clientId,
      trustId: params.trustId,
      queueId: params.queueId.trim(),
    });
  }
  if (params.externalPostRef?.trim()) {
    return getDistributionQueueItemByExternalRef({
      userId: params.userId,
      clientId: params.clientId,
      trustId: params.trustId,
      externalPostRef: params.externalPostRef.trim(),
    });
  }
  return Promise.resolve(null);
}

/**
 * Updates queue sync fields and optionally records experiment result + feedback log row.
 */
export async function syncPublishedQueuePerformance(
  params: SyncPublishedQueuePerformanceParams
): Promise<{ ok: boolean; reason?: string; queueId?: string }> {
  const row = await resolveQueueRow(params);
  if (!row) return { ok: false, reason: "queue_not_found" };
  if (row.queueStatus !== "published") return { ok: false, reason: "not_published" };

  const measuredAt = params.measuredAt ?? new Date();
  const platform = row.platform.slice(0, 64);
  const format = row.contentType.slice(0, 64);

  try {
    const db = await getDb();
    await db
      .update(bentleyDistributionQueue)
      .set({
        lastSyncedAt: measuredAt,
        performanceSyncStatus: "synced",
        workflowNote: params.metrics.qualitativeNotes?.slice(0, 8000) ?? row.workflowNote,
      })
      .where(eq(bentleyDistributionQueue.id, row.id));
  } catch (e) {
    console.error("[post-publication-sync] queue update failed", e);
    return { ok: false, reason: "db_error" };
  }

  if (row.experimentVariantId) {
    const attr = `[publish_sync platform=${platform}|format=${format}|queue=${row.id}]`;
    const notes = [attr, params.metrics.qualitativeNotes ?? ""].filter(Boolean).join("\n");
    const payload: ExperimentResultPayload = {
      views: params.metrics.views ?? undefined,
      clicks: params.metrics.clicks ?? undefined,
      comments: params.metrics.comments ?? undefined,
      saves: params.metrics.saves ?? undefined,
      shares: params.metrics.shares ?? undefined,
      leads: params.metrics.leads ?? undefined,
      conversions: params.metrics.conversions ?? undefined,
      impressions: params.metrics.impressions ?? undefined,
      negativeSentimentRatio: params.metrics.negativeSentimentRatio ?? undefined,
      qualitativeNotes: notes.slice(0, 8000),
      measuredAt,
    };
    await recordExperimentResult({ experimentVariantId: row.experimentVariantId, payload });
  }

  try {
    const db = await getDb();
    await db.insert(contentFeedbackLog).values({
      id: crypto.randomUUID(),
      userId: params.userId,
      clientId: params.clientId,
      trustId: params.trustId,
      source: "publishing_sync",
      campaignId: null,
      platform: row.platform,
      sentiment: null,
      scoreDelta: null,
      rawPayload: {
        queueId: row.id,
        externalPostRef: row.externalPostRef,
        metrics: params.metrics,
        experimentVariantId: row.experimentVariantId,
        experimentId: row.experimentId,
      },
      notes: `Post metrics sync for ${row.title.slice(0, 120)}`.slice(0, 8000),
    });
  } catch (e) {
    console.warn("[post-publication-sync] feedback log skipped", e);
  }

  return { ok: true, queueId: row.id };
}
