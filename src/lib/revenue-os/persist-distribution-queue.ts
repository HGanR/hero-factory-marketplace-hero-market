/**
 * Persists draft distribution queue rows + targets for launch / test buckets.
 */

import crypto from "crypto";
import { getDb } from "@/lib/db";
import { bentleyDistributionQueue, bentleyDistributionQueueTargets } from "@/lib/db/schema";
import type { DistributionPlanItem } from "@/lib/revenue-os/market-sweep-schema";

export type PersistDraftDistributionParams = {
  userId: string;
  clientId: string;
  trustId: string;
  marketSweepSnapshotId: string | null;
  experimentId: string | null;
  variantIdsByKey: Record<string, string> | null;
  launchNow: DistributionPlanItem[];
  testNext: DistributionPlanItem[];
};

/**
 * Inserts draft queue rows for launch + test cells. Skips when lists empty. Does not throw.
 */
export async function persistDraftDistributionQueue(params: PersistDraftDistributionParams): Promise<{
  queueIds: string[];
} | null> {
  if (!params.launchNow.length && !params.testNext.length) return null;

  try {
    const db = await getDb();
    const queueIds: string[] = [];

    const insertBucket = async (items: DistributionPlanItem[], winningSource: string) => {
      for (const item of items) {
        const qid = crypto.randomUUID();
        const variantKeyForLabel = (item.variantKey?.trim() || item.platform || "variant").slice(0, 128);
        const hookType = (item.hookType?.trim() || item.contentType || "hook").slice(0, 128);
        const targetFormat = (item.targetFormat?.trim() || item.contentType).slice(0, 64);
        const ctaType = (item.ctaType?.trim() || "none").slice(0, 64);
        const publishPriority = item.publishPriority ?? 0;
        const mapKey = item.variantKey?.trim() || variantKeyForLabel;
        const variantId = params.variantIdsByKey?.[mapKey] ?? null;
        await db.insert(bentleyDistributionQueue).values({
          id: qid,
          userId: params.userId,
          clientId: params.clientId,
          trustId: params.trustId,
          experimentId: params.experimentId,
          experimentVariantId: variantId,
          marketSweepSnapshotId: params.marketSweepSnapshotId,
          contentDeploymentId: null,
          title: `${variantKeyForLabel}: ${hookType}`.slice(0, 512),
          platform: item.platform.slice(0, 64),
          contentType: item.contentType.slice(0, 64),
          queueStatus: "draft",
          scheduledFor: null,
          publishedAt: null,
          publishPriority,
          winningSignalSource: winningSource.slice(0, 128),
          approvalStatus: "pending",
          publishAttemptCount: 0,
        });

        const tid = crypto.randomUUID();
        await db.insert(bentleyDistributionQueueTargets).values({
          id: tid,
          queueId: qid,
          targetPlatform: item.platform.slice(0, 64),
          targetProfileId: null,
          targetFormat,
          payloadJson: {
            variantKey: variantKeyForLabel,
            hookType,
            angle: item.angle,
            ctaType,
            rationale: item.rationale,
          },
          targetStatus: "draft",
        });
        queueIds.push(qid);
      }
    };

    await insertBucket(params.launchNow, "launch_now");
    await insertBucket(params.testNext, "test_next");

    return { queueIds };
  } catch (e) {
    console.error("[persist-distribution-queue] failed", e);
    return null;
  }
}
