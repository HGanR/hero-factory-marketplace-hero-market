/**
 * Build coordinated Bentley policy change sets from scenarios, rollouts, or rollback targets.
 */

import {
  getLatestSavedRollbackPackageForScenario,
  getPolicyRollbackPackageByIdForUser,
} from "@/lib/revenue-os/policy-rollback-db";
import { getPolicyRolloutPlanByIdForUser } from "@/lib/revenue-os/policy-rollout-db";
import { getPolicyScenarioByIdForUser } from "@/lib/revenue-os/policy-scenarios-db";
import { buildBlendedRollbackBundle, type RollbackUpsertItem } from "@/lib/revenue-os/reversible-policy-bundles";
import {
  recommendBentleyDeploymentOrdering,
  type PolicyFamily,
} from "@/lib/revenue-os/staged-deployment";

export type BentleyChangeSetType =
  | "forward_deploy"
  | "rollback_deploy"
  | "staged_deploy"
  | "blended_update";

export type ChangeSetItemShape = {
  id?: string;
  policyFamily: PolicyFamily;
  itemOrder: number;
  itemStatus: "pending" | "applied" | "failed" | "skipped";
  targetScopeJson: Record<string, unknown> | null;
  payloadJson: Record<string, unknown> | null;
  /** When payload cannot be built (sparse source). */
  skipReason?: string;
};

export type BuildBentleyPolicyChangeSetResult = {
  changeSet: {
    name: string;
    description: string | null;
    changeSetType: BentleyChangeSetType;
    scopeJson: Record<string, unknown> | null;
    sourceScenarioId: string | null;
    sourceRolloutPlanId: string | null;
    sourceRollbackPackageId: string | null;
    status: "draft";
  };
  items: ChangeSetItemShape[];
  deploymentSummary: {
    totalItems: number;
    applicableItems: number;
    skippedItems: number;
    families: PolicyFamily[];
  };
  riskSummary: { lines: string[]; partialFailureCount: number };
  rollbackLinkage: {
    rollbackPackageId: string | null;
    linkedScenarioId: string | null;
    advisoryLine: string;
  };
};

function scopeFromPayload(p: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!p || typeof p !== "object") return null;
  const clientId = p.clientId;
  const trustId = p.trustId;
  if (clientId == null && trustId == null) return null;
  return { clientId: String(clientId ?? ""), trustId: String(trustId ?? "") };
}

function orderItems(
  bundleItems: RollbackUpsertItem[],
  familyOrder: PolicyFamily[]
): RollbackUpsertItem[] {
  const rank = new Map<PolicyFamily, number>();
  familyOrder.forEach((f, i) => rank.set(f, i));
  const sorted = [...bundleItems].sort((a, b) => {
    const ra = rank.get(a.family) ?? 99;
    const rb = rank.get(b.family) ?? 99;
    if (ra !== rb) return ra - rb;
    return a.policyId.localeCompare(b.policyId);
  });
  return sorted;
}

function toChangeSetItems(ordered: RollbackUpsertItem[]): ChangeSetItemShape[] {
  return ordered.map((it, idx) => {
    const payload = it.payload as Record<string, unknown> | null;
    const skipReason = !it.payload ? it.skipReason ?? "no_payload" : undefined;
    return {
      policyFamily: it.family,
      itemOrder: idx,
      itemStatus: skipReason ? "skipped" : "pending",
      targetScopeJson: scopeFromPayload(payload),
      payloadJson: payload,
      skipReason,
    };
  });
}

async function resolveTargetSnapshot(input: {
  userId: string;
  proposedTargetSnapshotJson?: Record<string, unknown> | null;
  sourceScenarioId?: string | null;
  sourceRolloutPlanId?: string | null;
}): Promise<{ snapshot: Record<string, unknown>; sourceScenarioId: string | null; sourceRolloutPlanId: string | null }> {
  let snap = input.proposedTargetSnapshotJson && typeof input.proposedTargetSnapshotJson === "object"
    ? { ...input.proposedTargetSnapshotJson }
    : {};
  let sourceScenarioId = input.sourceScenarioId?.trim() || null;
  let sourceRolloutPlanId = input.sourceRolloutPlanId?.trim() || null;

  if (sourceRolloutPlanId && (!snap || Object.keys(snap).length === 0)) {
    const plan = await getPolicyRolloutPlanByIdForUser({ userId: input.userId, planId: sourceRolloutPlanId });
    if (plan?.sourceScenarioId) {
      sourceScenarioId = plan.sourceScenarioId;
    }
  }

  if (sourceScenarioId && (!snap || Object.keys(snap).length === 0)) {
    const sc = await getPolicyScenarioByIdForUser({ userId: input.userId, scenarioId: sourceScenarioId });
    const proposed = sc?.proposedPolicySnapshotJson;
    if (proposed && typeof proposed === "object") {
      snap = proposed as Record<string, unknown>;
    }
  }

  return { snapshot: snap, sourceScenarioId, sourceRolloutPlanId };
}

/**
 * Forward or blended deployment from a proposed policy snapshot (scenario / rollout / inline).
 */
export async function buildBentleyPolicyChangeSet(input: {
  userId: string;
  name: string;
  description?: string | null;
  changeSetType?: BentleyChangeSetType;
  proposedTargetSnapshotJson?: Record<string, unknown> | null;
  sourceScenarioId?: string | null;
  sourceRolloutPlanId?: string | null;
  scopeJson?: Record<string, unknown> | null;
  /** Override default family ordering (notifications → automation → autonomous). */
  familyOrder?: PolicyFamily[];
  families?: Array<PolicyFamily>;
}): Promise<BuildBentleyPolicyChangeSetResult> {
  const uid = String(input.userId).trim();
  const { snapshot, sourceScenarioId, sourceRolloutPlanId } = await resolveTargetSnapshot({
    userId: uid,
    proposedTargetSnapshotJson: input.proposedTargetSnapshotJson ?? null,
    sourceScenarioId: input.sourceScenarioId ?? null,
    sourceRolloutPlanId: input.sourceRolloutPlanId ?? null,
  });

  const bundle = await buildBlendedRollbackBundle({
    userId: uid,
    rollbackTargetSnapshotJson: snapshot,
    families: input.families,
  });

  const ordering = recommendBentleyDeploymentOrdering({
    familiesPresent: bundle.items.map((i) => i.family),
    overrideOrder: input.familyOrder,
  });
  const ordered = orderItems(bundle.items, ordering.order);

  const items = toChangeSetItems(ordered);
  const applicable = items.filter((i) => i.itemStatus === "pending").length;
  const skipped = items.length - applicable;

  const riskLines: string[] = [];
  if (bundle.partialFailures.length) {
    riskLines.push(
      `${bundle.partialFailures.length} policy row(s) could not be merged with live state — those items are skipped.`
    );
  }
  const normFamilies = new Set(bundle.items.map((i) => i.family));

  let rollbackPkgId: string | null = null;
  if (sourceScenarioId) {
    const pkg = await getLatestSavedRollbackPackageForScenario({ userId: uid, scenarioId: sourceScenarioId });
    rollbackPkgId = pkg?.id ?? null;
  }

  const advisory =
    rollbackPkgId != null
      ? "A saved rollback package exists for this scenario — you can revert via Policy Rollback if needed."
      : "No saved rollback package linked to this scenario — consider preparing one before applying.";

  return {
    changeSet: {
      name: input.name.trim() || "Policy change set",
      description: input.description?.trim() || null,
      changeSetType: input.changeSetType ?? "forward_deploy",
      scopeJson: input.scopeJson ?? null,
      sourceScenarioId,
      sourceRolloutPlanId,
      sourceRollbackPackageId: null,
      status: "draft",
    },
    items,
    deploymentSummary: {
      totalItems: items.length,
      applicableItems: applicable,
      skippedItems: skipped,
      families: [...normFamilies] as PolicyFamily[],
    },
    riskSummary: { lines: riskLines, partialFailureCount: bundle.partialFailures.length },
    rollbackLinkage: {
      rollbackPackageId: rollbackPkgId,
      linkedScenarioId: sourceScenarioId,
      advisoryLine: advisory,
    },
  };
}

export function summarizeBentleyPolicyChangeSet(input: {
  name: string;
  deploymentSummary: BuildBentleyPolicyChangeSetResult["deploymentSummary"];
  changeSetType: BentleyChangeSetType;
}): string {
  const { deploymentSummary: d, name, changeSetType } = input;
  const fam = d.families.length ? d.families.join(", ") : "no families";
  return `${name} (${changeSetType}): ${d.applicableItems}/${d.totalItems} applicable upserts — families: ${fam}.`;
}

/**
 * Rollback-oriented change set (targets match rollback package snapshot shapes).
 */
export async function buildBentleyRollbackChangeSet(input: {
  userId: string;
  rollbackPackageId: string;
  name?: string | null;
  description?: string | null;
  families?: Array<PolicyFamily>;
}): Promise<BuildBentleyPolicyChangeSetResult> {
  const uid = String(input.userId).trim();
  const pkg = await getPolicyRollbackPackageByIdForUser({ userId: uid, packageId: input.rollbackPackageId });
  if (!pkg) {
    throw new Error("rollback_package_not_found");
  }
  const tgt = pkg.rollbackTargetSnapshotJson;
  if (!tgt || typeof tgt !== "object") {
    throw new Error("rollback_package_missing_target_snapshot");
  }

  const bundle = await buildBlendedRollbackBundle({
    userId: uid,
    rollbackTargetSnapshotJson: tgt as Record<string, unknown>,
    families: input.families,
  });
  const ordering = recommendBentleyDeploymentOrdering({
    familiesPresent: bundle.items.map((i) => i.family),
  });
  const ordered = orderItems(bundle.items, ordering.order);
  const items = toChangeSetItems(ordered);
  const applicable = items.filter((i) => i.itemStatus === "pending").length;

  const riskLines: string[] = [];
  if (bundle.partialFailures.length) {
    riskLines.push(`${bundle.partialFailures.length} merge warning(s) while building rollback upserts.`);
  }

  return {
    changeSet: {
      name: (input.name ?? pkg.name).trim() || "Rollback deployment",
      description: input.description?.trim() ?? null,
      changeSetType: "rollback_deploy",
      scopeJson: null,
      sourceScenarioId: pkg.sourceScenarioId,
      sourceRolloutPlanId: pkg.sourceRolloutPlanId,
      sourceRollbackPackageId: pkg.id,
      status: "draft",
    },
    items,
    deploymentSummary: {
      totalItems: items.length,
      applicableItems: applicable,
      skippedItems: items.length - applicable,
      families: [...new Set(bundle.items.map((i) => i.family))] as PolicyFamily[],
    },
    riskSummary: { lines: riskLines, partialFailureCount: bundle.partialFailures.length },
    rollbackLinkage: {
      rollbackPackageId: pkg.id,
      linkedScenarioId: pkg.sourceScenarioId,
      advisoryLine: "This change set replays the rollback package target snapshot — confirm before apply.",
    },
  };
}
