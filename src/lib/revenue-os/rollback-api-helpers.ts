/**
 * Shared rollback prepare / stored-package hydration for policy-rollback API routes.
 */

import { buildBlendedRollbackBundle } from "@/lib/revenue-os/reversible-policy-bundles";
import type { PolicyRollbackPackageRow } from "@/lib/revenue-os/policy-rollback-db";
import type { BentleyRollbackType } from "@/lib/revenue-os/policy-rollback-db";
import {
  buildBentleyRollbackPackage,
  type BentleyRollbackEngineResult,
} from "@/lib/revenue-os/rollback-packages";
import { buildRollbackWorkbenchUiPayload } from "@/lib/revenue-os/rollback-ui";

export async function buildPolicyRollbackPrepareResponse(input: {
  userId: string;
  clientId: string | null;
  trustId: string | null;
  planId: string | null;
  scenarioId: string | null;
  rollbackType: BentleyRollbackType;
  packageRow: PolicyRollbackPackageRow | null;
}): Promise<{
  engine: BentleyRollbackEngineResult;
  bundle: Awaited<ReturnType<typeof buildBlendedRollbackBundle>>;
  ui: ReturnType<typeof buildRollbackWorkbenchUiPayload>;
  staleWarning: string | null;
}> {
  const engine = await buildBentleyRollbackPackage({
    userId: input.userId,
    clientId: input.clientId,
    trustId: input.trustId,
    sourceRolloutPlanId: input.planId,
    sourceScenarioId: input.scenarioId,
    rollbackType: input.rollbackType,
  });
  const bundle = await buildBlendedRollbackBundle({
    userId: input.userId,
    rollbackTargetSnapshotJson: engine.rollbackPackage.rollbackTargetSnapshotJson as Record<string, unknown>,
  });
  const staleWarning: string | null = null;
  const ui = buildRollbackWorkbenchUiPayload({
    engine,
    packageRow: input.packageRow,
    bundle,
    staleWarning,
  });
  return { engine, bundle, ui, staleWarning };
}

export async function buildStoredRollbackResponse(input: {
  userId: string;
  row: PolicyRollbackPackageRow;
}): Promise<{
  engine: BentleyRollbackEngineResult;
  bundle: Awaited<ReturnType<typeof buildBlendedRollbackBundle>>;
  ui: ReturnType<typeof buildRollbackWorkbenchUiPayload>;
  staleWarning: string | null;
}> {
  const cur = input.row.currentPolicySnapshotJson;
  const tgt = input.row.rollbackTargetSnapshotJson;
  const delta = input.row.deltaJson;
  if (!cur || !tgt || !delta || typeof cur !== "object" || typeof tgt !== "object" || typeof delta !== "object") {
    throw new Error("stored_rollback_package_incomplete");
  }
  const rationale =
    input.row.rationaleJson && typeof input.row.rationaleJson === "object"
      ? (input.row.rationaleJson as Record<string, unknown>)
      : {};
  const engine: BentleyRollbackEngineResult = {
    rollbackPackage: {
      currentPolicySnapshotJson: cur as Record<string, unknown>,
      rollbackTargetSnapshotJson: tgt as Record<string, unknown>,
      deltaJson: delta as Record<string, unknown>,
      rationaleJson: rationale,
      rollbackType: (input.row.rollbackType as BentleyRollbackType) ?? "blended",
      name: input.row.name,
      sourceRolloutPlanId: input.row.sourceRolloutPlanId,
      sourceScenarioId: input.row.sourceScenarioId,
    },
    deltaSummary: "Loaded from saved rollback package.",
    riskSummary: { lines: [] },
    recommendation: "Review deltas and confirmation previews before applying.",
    affectedScopes: [],
    affectedPolicyFamilies: ["autonomous", "automation", "notifications"],
  };
  const bundle = await buildBlendedRollbackBundle({
    userId: input.userId,
    rollbackTargetSnapshotJson: tgt as Record<string, unknown>,
  });
  const staleWarning: string | null = null;
  const ui = buildRollbackWorkbenchUiPayload({ engine, packageRow: input.row, bundle, staleWarning });
  return { engine, bundle, ui, staleWarning };
}
