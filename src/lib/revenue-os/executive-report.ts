/**
 * Executive-readable daily / weekly reports from live Bentley state.
 */

import {
  buildBentleyOperatorOverview,
  type BentleyOperatorOverview,
} from "@/lib/revenue-os/operator-intelligence";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import { planBentleyOperatorActions } from "@/lib/revenue-os/operator-action-planner";
import { buildPolicyWorkbenchGuidanceLines } from "@/lib/revenue-os/policy-workbench-guidance";
import { buildBentleyRolloutCoaching } from "@/lib/revenue-os/rollout-coaching";
import { buildRolloutGuidanceLines } from "@/lib/revenue-os/rollout-guidance";
import { getBentleyRolloutMonitoringSnapshot, buildRolloutMonitoringGuidanceLines } from "@/lib/revenue-os/rollout-monitoring";
import { getLatestSavedRollbackPackageForUser } from "@/lib/revenue-os/policy-rollback-db";
import { buildRollbackPackageGuidanceLines } from "@/lib/revenue-os/rollback-guidance";
import { buildDeploymentGuidanceLines } from "@/lib/revenue-os/deployment-guidance";

export type ExecutiveReportMode = "daily_operator_report" | "weekly_executive_report";

export type BentleyExecutiveReport = {
  mode: ExecutiveReportMode;
  headline: string;
  executiveSummary: string;
  topWins: string[];
  topRisks: string[];
  workspaceSpotlight: Array<{ clientId: string; trustId: string; line: string }>;
  leadSummary: string;
  publishSummary: string;
  cadenceSummary: string;
  connectorSummary: string;
  recommendedActions: string[];
  exceptionSummary: string;
  /** Optional — saved policy tuning scenarios (read-only). */
  policyWorkbenchLine?: string;
  /** Optional — staged rollout coaching (read-only). */
  rolloutLine?: string;
  /** Optional — active saved-plan rollout monitoring (read-only). */
  rolloutMonitoringLine?: string;
  /** Optional — saved rollback package (read-only). */
  rollbackPackageLine?: string;
  /** Optional — coordinated policy deployments (read-only). */
  deploymentLine?: string;
};

export async function buildBentleyExecutiveReport(input: {
  userId: string;
  mode: ExecutiveReportMode;
  clientId?: string;
  trustId?: string;
  /** When provided, avoids a second operator overview fetch. */
  overview?: BentleyOperatorOverview | null;
}): Promise<BentleyExecutiveReport> {
  const uid = String(input.userId).trim();
  const filters = {
    clientIds: input.clientId ? [input.clientId] : undefined,
    trustIds: input.trustId ? [input.trustId] : undefined,
  };

  const overview =
    input.overview ?? (await buildBentleyOperatorOverview({ userId: uid, ...filters }));
  const ex = detectBentleyExceptions({ overview });
  const plan = planBentleyOperatorActions({
    workspaceSummaries: overview.workspaceSummaries,
    prioritization: overview.prioritization,
  });

  const g = overview.globalSummary;
  const topWins: string[] = [];
  if (g.totalHandoffReadyLeads > 0) {
    topWins.push(`${g.totalHandoffReadyLeads} handoff-ready lead(s) in pipeline.`);
  }
  const promote = overview.workspaceSummaries.reduce((a, s) => a + s.promotionReadyCount, 0);
  if (promote > 0) {
    topWins.push(`${promote} winner slot(s) ready for promotion.`);
  }
  if (overview.systemHealthScore >= 70 && g.totalFailedPublishes === 0) {
    topWins.push(`System health score ${overview.systemHealthScore} — execution stable.`);
  }

  const topRisks: string[] = [
    ...ex.criticalExceptions.map((e) => e.message),
    ...ex.warningExceptions.slice(0, 4).map((e) => e.message),
  ].slice(0, 8);

  const workspaceSpotlight = overview.prioritization.rankedWorkspaces.slice(0, 5).map((r) => {
    const label = r.workspace.clientId || "default";
    return {
      clientId: r.workspace.clientId,
      trustId: r.workspace.trustId,
      line: `Score ${r.combinedScore.toFixed(0)} — ${r.rationale || "workspace priority"}`,
    };
  });

  const leadSummary = `Open handoffs ${g.totalOpenHandoffs}; handoff-ready ${g.totalHandoffReadyLeads}; across ${g.workspaceCount || 0} workspace(s).`;
  const publishSummary = `Failed publishes: ${g.totalFailedPublishes}; unsynced published: ${g.totalUnsyncedPublished}; queue items: ${g.totalQueueItems}.`;
  const cadenceSummary =
    overview.workspaceSummaries
      .map((s) => s.cadenceSummary)
      .filter(Boolean)
      .slice(0, 2)
      .join(" ") || "No cadence summary lines — run cadence or add queue activity.";
  const connectorSummary =
    g.totalBlockedTargets > 0
      ? `${g.totalBlockedTargets} blocked connector target(s) — review OAuth and routing.`
      : "No severe connector blocks in aggregate.";

  const recommendedActions = [
    ...ex.recommendedEscalations,
    ...plan.immediateActions.slice(0, 4).map((a) => `${a.actionType}: ${a.reason.slice(0, 120)}`),
  ].slice(0, 10);

  const weekly = input.mode === "weekly_executive_report";
  const headline = weekly
    ? `Weekly executive snapshot — ${g.workspaceCount} workspace(s), health ${overview.systemHealthScore}.`
    : `Daily operator report — health ${overview.systemHealthScore}, ${g.totalQueueItems} queue item(s).`;

  const pw = await buildPolicyWorkbenchGuidanceLines({
    userId: uid,
    clientId: input.clientId,
    trustId: input.trustId,
  });
  const policyWorkbenchLine =
    [pw.bentleyPolicyWorkbenchSummaryLine, pw.bentleyTopScenarioRecommendationLine].filter(Boolean).join(" — ").slice(0, 600) ||
    undefined;

  const rolloutCoaching = buildBentleyRolloutCoaching({ overview });
  const rg = buildRolloutGuidanceLines(rolloutCoaching);
  const rolloutLine =
    [rg.bentleyRolloutSummaryLine, rg.bentleyPilotWorkspaceRecommendationLine].filter(Boolean).join(" — ").slice(0, 600) ||
    undefined;

  const rolloutMonitoring = await getBentleyRolloutMonitoringSnapshot({ userId: uid, overview });
  const rmon = buildRolloutMonitoringGuidanceLines(rolloutMonitoring);
  const rolloutMonitoringLine =
    [
      rmon.bentleyRolloutMonitoringSummaryLine,
      rmon.bentleyRolloutStageHealthLine,
      rmon.bentleyRolloutNextActionLine,
      rmon.bentleyRollbackRecommendedLine,
    ]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 600) || undefined;

  const rollbackPkg = await getLatestSavedRollbackPackageForUser({ userId: uid });
  const rbl = buildRollbackPackageGuidanceLines(rollbackPkg);
  const rollbackPackageLine =
    [rbl.bentleyRollbackPackageSummaryLine, rbl.bentleyRollbackBundleReadyLine].filter(Boolean).join(" — ").slice(0, 600) ||
    undefined;

  const dep = await buildDeploymentGuidanceLines({ userId: uid });
  const deploymentLine =
    [dep.bentleyDeploymentHistorySummaryLine, dep.bentleyLatestDeploymentOutcomeLine].filter(Boolean).join(" — ").slice(0, 600) ||
    undefined;

  const executiveSummary = [
    overview.recommendedFocus,
    ex.exceptionSummary,
    weekly ? "Weekly lens: prioritize structural fixes (connectors, cadence rhythm, lead routing)." : "",
    policyWorkbenchLine ? `Policy workbench: ${policyWorkbenchLine}` : "",
    rolloutLine ? `Rollout: ${rolloutLine}` : "",
    rolloutMonitoringLine ? `Rollout monitor: ${rolloutMonitoringLine}` : "",
    rollbackPackageLine ? `Rollback package: ${rollbackPackageLine}` : "",
    deploymentLine ? `Policy deployments: ${deploymentLine}` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);

  return {
    mode: input.mode,
    headline,
    executiveSummary,
    topWins,
    topRisks,
    workspaceSpotlight,
    leadSummary,
    publishSummary,
    cadenceSummary,
    connectorSummary,
    recommendedActions,
    exceptionSummary: ex.exceptionSummary,
    policyWorkbenchLine,
    rolloutLine,
    rolloutMonitoringLine,
    rollbackPackageLine,
    deploymentLine,
  };
}
