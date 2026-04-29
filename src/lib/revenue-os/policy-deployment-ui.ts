/**
 * Pure UI payload builders for Policy Deployment (change sets, staging, history).
 */

import type { BuildBentleyPolicyChangeSetResult } from "@/lib/revenue-os/policy-change-sets";
import type { BentleyStagedDeploymentPlan } from "@/lib/revenue-os/staged-deployment";
import type { DeploymentHistoryEntry, DeploymentHistorySummary } from "@/lib/revenue-os/policy-deployment-history";
import type { PolicyChangeSetItemRow } from "@/lib/revenue-os/policy-change-sets-db";

export type ChangeSetSummaryCard = {
  title: string;
  subtitle: string;
  badges: string[];
  stats: { applicable: number; total: number; skipped: number };
};

export function buildChangeSetSummaryCard(input: BuildBentleyPolicyChangeSetResult): ChangeSetSummaryCard {
  const d = input.deploymentSummary;
  return {
    title: input.changeSet.name,
    subtitle: input.changeSet.description ?? "Coordinated policy deployment",
    badges: [
      input.changeSet.changeSetType,
      ...d.families,
      input.riskSummary.partialFailureCount > 0 ? "merge warnings" : "clean merge",
    ],
    stats: { applicable: d.applicableItems, total: d.totalItems, skipped: d.skippedItems },
  };
}

export function buildStagedDeploymentTimeline(plan: BentleyStagedDeploymentPlan): Array<{
  stageIndex: number;
  label: string;
  detail: string;
}> {
  return plan.stages.map((s) => ({
    stageIndex: s.stageIndex,
    label: s.label,
    detail: `${s.scopeDescription} — ${s.familiesInStage.join(", ")}`,
  }));
}

export function buildPerFamilyApplyTable(items: PolicyChangeSetItemRow[]): Array<{
  family: string;
  order: number;
  status: string;
  policyId: string;
  hasPayload: boolean;
}> {
  return items.map((row) => ({
    family: row.policyFamily,
    order: row.itemOrder,
    status: row.itemStatus,
    policyId: String((row.payloadJson as Record<string, unknown> | null)?.id ?? ""),
    hasPayload: Boolean(row.payloadJson),
  }));
}

export function buildPerItemResultList(
  items: PolicyChangeSetItemRow[]
): Array<{ family: string; order: number; status: string; result: Record<string, unknown> | null }> {
  return items.map((row) => ({
    family: row.policyFamily,
    order: row.itemOrder,
    status: row.itemStatus,
    result: (row.resultJson as Record<string, unknown> | null) ?? null,
  }));
}

export function buildDeploymentHistoryTimeline(entries: DeploymentHistoryEntry[]): Array<{
  changeSetId: string;
  name: string;
  status: string;
  changeSetType: string;
  updatedAt: string;
  runStatus: string | null;
  linkedRollbackId: string | null;
}> {
  return entries.map((e) => ({
    changeSetId: e.changeSet.id,
    name: e.changeSet.name,
    status: e.changeSet.status,
    changeSetType: e.changeSet.changeSetType,
    updatedAt: e.changeSet.updatedAt?.toISOString?.() ?? "",
    runStatus: e.latestRun?.runStatus ?? null,
    linkedRollbackId: e.linkedRollbackPackageId,
  }));
}

export function buildLinkedRollbackBadge(linkedRollbackPackageId: string | null): {
  visible: boolean;
  label: string;
} {
  if (!linkedRollbackPackageId) return { visible: false, label: "" };
  return { visible: true, label: `Rollback: ${linkedRollbackPackageId.slice(0, 8)}…` };
}

export function buildPartialFailureWarningPanel(input: {
  failed: number;
  applied: number;
  errors: string[];
}): { show: boolean; title: string; lines: string[] } {
  if (input.failed === 0) return { show: false, title: "", lines: [] };
  return {
    show: true,
    title: "Partial failure",
    lines: [
      `${input.applied} applied, ${input.failed} failed.`,
      ...input.errors.slice(0, 6),
    ],
  };
}

export function buildDeploymentHistorySummaryBlock(summary: DeploymentHistorySummary): string {
  return summary.lines.join(" ") || "No recent coordinated deployments recorded.";
}
