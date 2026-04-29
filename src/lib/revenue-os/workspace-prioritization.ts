/**
 * Rank workspaces by urgency vs opportunity for operator focus.
 */

import type { OperatorWorkspaceSummary } from "@/lib/revenue-os/operator-types";
import type { OperatorWorkspaceKey } from "@/lib/revenue-os/operator-workspaces";

export type WorkspacePriorityRow = {
  workspace: OperatorWorkspaceKey;
  urgencyScore: number;
  opportunityScore: number;
  combinedScore: number;
  rationale: string;
};

export type WorkspacePrioritizationResult = {
  rankedWorkspaces: WorkspacePriorityRow[];
  topUrgentWorkspace: WorkspacePriorityRow | null;
  topOpportunityWorkspace: WorkspacePriorityRow | null;
  deprioritizedWorkspaces: WorkspacePriorityRow[];
};

export type PrioritizeBentleyWorkspacesInput = {
  workspaceSummaries: OperatorWorkspaceSummary[];
};

export function prioritizeBentleyWorkspaces(
  input: PrioritizeBentleyWorkspacesInput
): WorkspacePrioritizationResult {
  const rows: WorkspacePriorityRow[] = [];
  for (const s of input.workspaceSummaries) {
    const urgencyScore =
      s.failedCount * 8 +
      s.blockedConnectorTargets * 5 +
      s.openHandoffs * 4 +
      s.staleBacklogCount * 3 +
      s.publishedUnsyncedCount * 2;
    const opportunityScore =
      s.promotionReadyCount * 6 +
      s.handoffReadyLeads * 3 +
      (s.connectorAutoPublishReady > 0 ? 4 : 0) +
      s.approvedOrScheduledCount * 1;
    const combinedScore = urgencyScore * 0.55 + opportunityScore * 0.45;
    rows.push({
      workspace: s.workspace,
      urgencyScore,
      opportunityScore,
      combinedScore,
      rationale: [
        s.failedCount ? `${s.failedCount} failed` : "",
        s.blockedConnectorTargets ? `${s.blockedConnectorTargets} blocked` : "",
        s.promotionReadyCount ? `${s.promotionReadyCount} promote-ready` : "",
      ]
        .filter(Boolean)
        .join("; ")
        .slice(0, 400),
    });
  }
  rows.sort((a, b) => b.combinedScore - a.combinedScore);
  const rankedWorkspaces = rows;
  const topUrgent = [...rows].sort((a, b) => b.urgencyScore - a.urgencyScore)[0] ?? null;
  const topOpp = [...rows].sort((a, b) => b.opportunityScore - a.opportunityScore)[0] ?? null;
  const deprioritizedWorkspaces = rows.filter((r) => r.combinedScore < 8).slice(0, 12);
  return {
    rankedWorkspaces,
    topUrgentWorkspace: topUrgent,
    topOpportunityWorkspace: topOpp,
    deprioritizedWorkspaces,
  };
}
