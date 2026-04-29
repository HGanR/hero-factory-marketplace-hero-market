/**
 * Short narrative digest for operator dashboards and digests.
 */

import type { BentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";

export type BentleyOperatorDigest = {
  headline: string;
  keyWins: string[];
  keyRisks: string[];
  nextBestActions: string[];
  shortNarrative: string;
};

export type BuildBentleyOperatorDigestInput = {
  overview: BentleyOperatorOverview;
};

export function buildBentleyOperatorDigest(input: BuildBentleyOperatorDigestInput): BentleyOperatorDigest {
  const o = input.overview;
  const g = o.globalSummary;
  const p = o.prioritization;

  const keyWins: string[] = [];
  if (g.totalHandoffReadyLeads > 0) {
    keyWins.push(`${g.totalHandoffReadyLeads} handoff-ready lead(s) across workspaces.`);
  }
  const promoteTotal = o.workspaceSummaries.reduce((a, s) => a + s.promotionReadyCount, 0);
  if (promoteTotal > 0) {
    keyWins.push(`${promoteTotal} promoted winner slot(s) ready to publish.`);
  }

  const keyRisks: string[] = [...o.riskFlags];
  if (g.totalFailedPublishes > 0) keyRisks.push(`Publish failures: ${g.totalFailedPublishes}.`);
  if (g.totalBlockedTargets > 0) keyRisks.push(`Connector blocks: ${g.totalBlockedTargets}.`);

  const nextBestActions = o.priorityActions.slice(0, 8).map(
    (a) => `${a.actionType} (${a.workspace.clientId || "default"}): ${a.reason.slice(0, 120)}`
  );

  const headline =
    o.systemHealthScore >= 75
      ? "Operations healthy — prioritize wins and clear small backlogs."
      : o.systemHealthScore >= 50
        ? "Mixed signals — address failures and connector gaps first."
        : "Attention needed — failures, blocks, or handoffs are stacking.";

  const shortNarrative = [
    o.recommendedFocus,
    p.topUrgentWorkspace
      ? `Urgent: ${p.topUrgentWorkspace.rationale}`
      : "",
    p.topOpportunityWorkspace
      ? `Opportunity: ${p.topOpportunityWorkspace.rationale}`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1500);

  return {
    headline,
    keyWins,
    keyRisks,
    nextBestActions,
    shortNarrative,
  };
}
