/**
 * Optional persistence for explainability / simulation snapshots.
 */

import crypto from "crypto";
import { getDb } from "@/lib/db";
import { bentleyExplainabilitySnapshots } from "@/lib/db/schema";

export type ExplainabilitySnapshotType =
  | "decision_explanation"
  | "policy_simulation"
  | "cadence_simulation"
  | "publish_routing_explanation";

export async function insertBentleyExplainabilitySnapshot(params: {
  userId: string;
  clientId?: string | null;
  trustId?: string | null;
  snapshotType: ExplainabilitySnapshotType;
  inputJson: Record<string, unknown>;
  outputJson: Record<string, unknown>;
}): Promise<{ id: string; ok: boolean }> {
  const uid = String(params.userId).trim();
  if (!uid) return { id: "", ok: false };
  const id = crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyExplainabilitySnapshots).values({
      id,
      userId: uid,
      clientId: params.clientId?.trim() || null,
      trustId: params.trustId?.trim() || null,
      snapshotType: params.snapshotType,
      inputJson: params.inputJson,
      outputJson: params.outputJson,
    });
    return { id, ok: true };
  } catch (e) {
    console.warn("[explainability-db] insert failed", e);
    return { id, ok: false };
  }
}
