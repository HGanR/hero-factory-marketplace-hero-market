import crypto from "crypto";
import { getDb } from "@/lib/db";
import {
  bentleyContentExperiments,
  bentleyContentExperimentVariants,
} from "@/lib/db/schema";
import type { MarketSweepExperimentPlan } from "@/lib/revenue-os/market-sweep-schema";

/**
 * Persists a draft experiment + variants (status draft). Does not throw — returns null on failure.
 */
export async function persistDraftExperimentPlan(params: {
  userId: string;
  clientId: string;
  trustId: string;
  marketSweepSnapshotId: string | null;
  nextActionType: string;
  contentGenerationMode: string;
  plan: MarketSweepExperimentPlan;
}): Promise<{ experimentId: string; variantIdsByKey: Record<string, string> } | null> {
  try {
    const db = await getDb();
    const experimentId = crypto.randomUUID();
    await db.insert(bentleyContentExperiments).values({
      id: experimentId,
      userId: params.userId,
      clientId: params.clientId,
      trustId: params.trustId,
      marketSweepSnapshotId: params.marketSweepSnapshotId,
      nextActionType: params.nextActionType.slice(0, 64),
      contentGenerationMode: params.contentGenerationMode.slice(0, 64),
      experimentTheme: params.plan.experimentTheme.slice(0, 300),
      status: "draft",
      hypothesis: params.plan.hypothesis.slice(0, 8000),
      primaryMetric: params.plan.primaryMetric.slice(0, 120),
      startedAt: null,
      completedAt: null,
    });

    const variantIdsByKey: Record<string, string> = {};
    for (const v of params.plan.variants) {
      const vid = crypto.randomUUID();
      variantIdsByKey[v.variantKey] = vid;
      await db.insert(bentleyContentExperimentVariants).values({
        id: vid,
        experimentId,
        variantKey: v.variantKey.slice(0, 8),
        hookType: v.hookType.slice(0, 64),
        angle: v.angle.slice(0, 500),
        ctaType: v.ctaType.slice(0, 64),
        platform: v.platform.slice(0, 64),
        contentType: v.contentType.slice(0, 64),
        generationPayloadJson: {
          framingStyle: v.framingStyle,
          angle: v.angle,
          hookType: v.hookType,
          ctaType: v.ctaType,
        },
        status: "draft",
      });
    }

    return { experimentId, variantIdsByKey };
  } catch (e) {
    console.error("[experiment-persist] failed", e);
    return null;
  }
}
