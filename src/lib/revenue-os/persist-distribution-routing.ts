/**
 * Persists connector routing results onto bentley_distribution_queue_targets (idempotent upsert by target id).
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyDistributionQueueTargets } from "@/lib/db/schema";
import type { RoutedTargetPlan } from "@/lib/revenue-os/distribution-routing";

export type PersistDistributionRoutingInput = {
  routedTargets: RoutedTargetPlan[];
};

export async function persistDistributionRouting(
  input: PersistDistributionRoutingInput
): Promise<{ ok: boolean; updated: number }> {
  if (!input.routedTargets.length) return { ok: true, updated: 0 };
  let updated = 0;
  try {
    const db = await getDb();
    for (const r of input.routedTargets) {
      await db
        .update(bentleyDistributionQueueTargets)
        .set({
          targetProfileId: r.selectedProfileId,
          payloadJson: r.payloadJson,
          routingStatus: r.routingStatus,
          routingWarningsJson: r.routingWarnings,
          updatedAt: new Date(),
        })
        .where(eq(bentleyDistributionQueueTargets.id, r.targetId));
      updated++;
    }
    return { ok: true, updated };
  } catch (e) {
    console.warn("[persist-distribution-routing] failed", e);
    return { ok: false, updated };
  }
}
