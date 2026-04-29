/**
 * Launch-readiness model for Revenue OS — derived from Bentley workflow v3,
 * posting intent, connected OAuth accounts, analysis output, and first-campaign draft state.
 * Read-only: does not trigger launch or mutate workflow.
 */

import type { SocialPlatform } from "@/lib/social/config";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { BentleyWorkflowPhaseId, BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";
import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";
import type { WorkflowOperationalGuidance } from "@/lib/revenue-os/publishing-workflow";
import type { ConnectorCoverageSummary } from "@/lib/revenue-os/distribution-routing";
import type { ProactiveAutomationGuidance } from "@/lib/revenue-os/proactive-automation-guidance";
import type {
  AutonomousActionGuidance,
  NotificationEscalationGuidance,
} from "@/lib/revenue-os/market-sweep-schema";

export type LaunchReadinessFinalKind =
  | "ready"
  | "blocked_workflow"
  | "blocked_connection"
  | "blocked_content";

export type LaunchReadinessRow = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export type LaunchReadinessSummary = {
  rows: LaunchReadinessRow[];
  finalKind: LaunchReadinessFinalKind;
  headline: string;
  subline: string;
};

function wfDone(wf: BentleyWorkflowState, phase: BentleyWorkflowPhaseId): boolean {
  return Boolean(wf.completed[phase]);
}

/** Draft / bundle sufficient to publish from the first-campaign card path (no auto-post). */
export function hasDraftableFirstCampaignContent(
  analysis: RevenueOsAnalyzeResponse | null,
  contentEngineOutput: ContentEngineOutput | null,
  postingPlatforms: SocialPlatform[]
): boolean {
  return (
    analysis != null &&
    contentEngineOutput != null &&
    postingPlatforms.length > 0
  );
}

/**
 * Computes checklist + final blocked reason (priority: workflow → platforms → OAuth → draft).
 */
export function computeBentleyLaunchReadinessSummary(input: {
  wf: BentleyWorkflowState;
  postingPlatforms: SocialPlatform[];
  /** Normalized from connected accounts — see `connectedSocialPlatformsSet` */
  connectedSocialPlatforms: ReadonlySet<SocialPlatform>;
  analysis: RevenueOsAnalyzeResponse | null;
  contentEngineOutput: ContentEngineOutput | null;
  hasSessionDraftMeta: boolean;
  /** Optional — when market sweep / workspace has captured lead intent aggregates. */
  leadSignalSummary?: LeadSignalSummary | null;
  /** Optional — publishing + handoff operational snapshot. */
  workflowOperational?: WorkflowOperationalGuidance | null;
  /** Optional — connector routing summary (OAuth + capability). */
  connectorCoverageSummary?: ConnectorCoverageSummary | null;
  /** Optional — multi-workspace operator command center (Bentley). */
  operatorCommandCenter?: {
    systemHealthScore?: number;
    topUrgentWorkspace?: string;
    topOpportunityWorkspace?: string;
    operatorActionSummary?: string;
    leadHandoffBacklogSummary?: string;
    connectorGapSummary?: string;
    publishFailureSummary?: string;
    bentleyExplainabilitySummaryLine?: string;
    bentleyTopDecisionRationaleLine?: string;
    bentleySimulationSummaryLine?: string;
    bentleyPolicyDeltaRiskLine?: string;
  } | null;
  /** Optional — proactive automation + exception lines. */
  proactiveAutomation?: ProactiveAutomationGuidance | null;
  /** Optional — notifications / escalation summary. */
  notificationEscalation?: NotificationEscalationGuidance | null;
  /** Optional — policy-governed autonomous actions. */
  autonomousGuidance?: AutonomousActionGuidance | null;
}): LaunchReadinessSummary {
  const {
    wf,
    postingPlatforms,
    connectedSocialPlatforms,
    analysis,
    contentEngineOutput,
    hasSessionDraftMeta,
    leadSignalSummary,
    workflowOperational,
    connectorCoverageSummary,
    operatorCommandCenter,
    proactiveAutomation,
    notificationEscalation,
    autonomousGuidance,
  } = input;

  const uniqPlatforms = [...new Set(postingPlatforms)];

  const rowResearch: LaunchReadinessRow = {
    id: "research",
    label: "Research",
    ok: wfDone(wf, "research"),
  };
  const rowTrends: LaunchReadinessRow = {
    id: "trends",
    label: "Trends & synthesis",
    ok: wfDone(wf, "trends"),
  };
  const rowMarketSweep: LaunchReadinessRow = {
    id: "market_sweep",
    label: "Market intelligence sweep",
    ok: wfDone(wf, "market_sweep"),
  };
  const rowContent: LaunchReadinessRow = {
    id: "content",
    label: "Viral content",
    ok: wfDone(wf, "content"),
  };
  const rowCampaign: LaunchReadinessRow = {
    id: "campaign",
    label: "Campaign",
    ok: wfDone(wf, "campaign_notes") && wfDone(wf, "campaign_generation"),
    detail: "Notes + generated campaign",
  };
  const rowBrief: LaunchReadinessRow = {
    id: "media_brief",
    label: "Media brief",
    ok: wfDone(wf, "media_brief"),
  };

  const analysisCompleteInWorkflow = wfDone(wf, "analysis");
  const hasCurrentDashboardAnalysis = analysis != null;
  const rowAnalysis: LaunchReadinessRow = {
    id: "analysis",
    label: "Full analysis",
    ok: analysisCompleteInWorkflow || hasCurrentDashboardAnalysis,
    detail: !analysisCompleteInWorkflow && !hasCurrentDashboardAnalysis
      ? undefined
      : analysisCompleteInWorkflow && hasCurrentDashboardAnalysis
        ? "Bentley workflow + dashboard"
        : analysisCompleteInWorkflow
          ? "Bentley workflow"
          : "Dashboard (this session)",
  };

  const rowPosting: LaunchReadinessRow = {
    id: "posting_platforms",
    label: "Posting platforms selected",
    ok: uniqPlatforms.length > 0,
    detail: uniqPlatforms.length ? uniqPlatforms.join(", ") : "None selected in intake",
  };

  const missingOAuth = uniqPlatforms.filter((p) => !connectedSocialPlatforms.has(p));
  const rowOAuth: LaunchReadinessRow = {
    id: "oauth",
    label: "Connected accounts (selected platforms)",
    ok: uniqPlatforms.length > 0 && missingOAuth.length === 0,
    detail:
      uniqPlatforms.length === 0
        ? "Select platforms first"
        : missingOAuth.length
          ? `Missing: ${missingOAuth.join(", ")}`
          : "All selected platforms connected",
  };

  const draftable = hasDraftableFirstCampaignContent(analysis, contentEngineOutput, uniqPlatforms);
  const firstAssetReady = hasSessionDraftMeta || draftable;

  const rowAsset: LaunchReadinessRow = {
    id: "first_asset",
    label: "First campaign asset / draft",
    ok: firstAssetReady,
    detail: hasSessionDraftMeta
      ? "Saved draft in this session"
      : draftable
        ? "Content bundle + analysis available"
        : "Generate content and save a draft, or complete the bundle above",
  };

  const rowLeadSignals: LaunchReadinessRow | null =
    leadSignalSummary && leadSignalSummary.totalSignals > 0
      ? {
          id: "lead_signals",
          label: "Lead intent signals",
          ok: leadSignalSummary.handoffReadyLeads > 0,
          detail: `${leadSignalSummary.totalSignals} captured; ${leadSignalSummary.handoffReadyLeads} handoff-ready; ${leadSignalSummary.objectionClusters.length} objection cluster(s).`,
        }
      : null;

  const rowPublishing: LaunchReadinessRow | null =
    workflowOperational &&
    (workflowOperational.approvalBottleneckLine ||
      workflowOperational.publishFailureLine ||
      workflowOperational.unsyncedMetricLine)
      ? {
          id: "publishing_workflow",
          label: "Publishing workflow",
          ok: !workflowOperational.approvalBottleneckLine && !workflowOperational.publishFailureLine,
          detail: [
            workflowOperational.approvalBottleneckLine,
            workflowOperational.publishFailureLine,
            workflowOperational.unsyncedMetricLine,
          ]
            .filter(Boolean)
            .join(" ")
            .slice(0, 400),
        }
      : null;

  const rowConnectors: LaunchReadinessRow | null =
    connectorCoverageSummary &&
    (connectorCoverageSummary.autoPublishReadyCount > 0 ||
      connectorCoverageSummary.manualFallbackCount > 0 ||
      connectorCoverageSummary.connectedPlatforms.length > 0)
      ? {
          id: "connector_routing",
          label: "Connector routing (Bentley)",
          ok: connectorCoverageSummary.autoPublishReadyCount > 0,
          detail: [
            connectorCoverageSummary.matrixSummaryLine,
            connectorCoverageSummary.recommendedConnectorAction,
          ]
            .filter(Boolean)
            .join(" ")
            .slice(0, 400),
        }
      : null;

  const rowCadence: LaunchReadinessRow | null =
    workflowOperational &&
    (workflowOperational.cadenceSummary ||
      workflowOperational.cadencePromotionCount != null ||
      workflowOperational.cadenceRetryCount != null)
      ? {
          id: "cadence_scheduler",
          label: "Cadence scheduler",
          ok:
            (workflowOperational.cadenceRetryCount ?? 0) < 2 &&
            (workflowOperational.cadenceStaleCount ?? 0) < 3,
          detail: [
            workflowOperational.cadenceSummary,
            workflowOperational.cadenceNextAction,
            workflowOperational.cadencePromotionCount != null
              ? `${workflowOperational.cadencePromotionCount} promote`
              : "",
            workflowOperational.cadenceSuppressionCount != null
              ? `${workflowOperational.cadenceSuppressionCount} suppress`
              : "",
          ]
            .filter(Boolean)
            .join(" — ")
            .slice(0, 400),
        }
      : null;

  const rowOperator: LaunchReadinessRow | null =
    operatorCommandCenter &&
    (operatorCommandCenter.systemHealthScore != null ||
      operatorCommandCenter.topUrgentWorkspace ||
      operatorCommandCenter.operatorActionSummary ||
      operatorCommandCenter.bentleyExplainabilitySummaryLine)
      ? {
          id: "operator_command_center",
          label: "Operator command center",
          ok: (operatorCommandCenter.systemHealthScore ?? 70) >= 55,
          detail: [
            operatorCommandCenter.systemHealthScore != null
              ? `Health ${operatorCommandCenter.systemHealthScore}`
              : "",
            operatorCommandCenter.topUrgentWorkspace
              ? `Urgent: ${operatorCommandCenter.topUrgentWorkspace}`
              : "",
            operatorCommandCenter.topOpportunityWorkspace
              ? `Opportunity: ${operatorCommandCenter.topOpportunityWorkspace}`
              : "",
            operatorCommandCenter.operatorActionSummary,
            operatorCommandCenter.bentleyExplainabilitySummaryLine,
            operatorCommandCenter.bentleyTopDecisionRationaleLine,
            operatorCommandCenter.bentleySimulationSummaryLine,
            operatorCommandCenter.bentleyPolicyDeltaRiskLine,
          ]
            .filter(Boolean)
            .join(" — ")
            .slice(0, 400),
        }
      : null;

  const rowProactive: LaunchReadinessRow | null =
    proactiveAutomation &&
    (proactiveAutomation.criticalExceptionCount > 0 ||
      proactiveAutomation.overdueAutomationSummary ||
      proactiveAutomation.topEscalationLine ||
      proactiveAutomation.nextScheduledAutomationLine ||
      proactiveAutomation.reportStatusLine)
      ? {
          id: "proactive_automation",
          label: "Proactive automations",
          ok: (proactiveAutomation.criticalExceptionCount ?? 0) === 0,
          detail: [
            proactiveAutomation.criticalExceptionCount
              ? `${proactiveAutomation.criticalExceptionCount} critical exception(s)`
              : "",
            proactiveAutomation.topEscalationLine,
            proactiveAutomation.overdueAutomationSummary,
            proactiveAutomation.nextScheduledAutomationLine,
          ]
            .filter(Boolean)
            .join(" — ")
            .slice(0, 400),
        }
      : null;

  const rows: LaunchReadinessRow[] = [
    rowResearch,
    rowTrends,
    rowMarketSweep,
    rowContent,
    rowCampaign,
    rowBrief,
    rowAnalysis,
    rowPosting,
    rowOAuth,
    rowAsset,
    ...(rowLeadSignals ? [rowLeadSignals] : []),
    ...(rowPublishing ? [rowPublishing] : []),
    ...(rowConnectors ? [rowConnectors] : []),
    ...(rowCadence ? [rowCadence] : []),
    ...(rowOperator ? [rowOperator] : []),
    ...(rowProactive ? [rowProactive] : []),
    ...(notificationEscalation &&
    (notificationEscalation.bentleyUnreadInAppCount != null ||
      notificationEscalation.bentleyNotificationSummaryLine)
      ? [
          {
            id: "notifications_escalation",
            label: "Notifications",
            ok:
              (notificationEscalation.bentleyUnreadInAppCount ?? 0) < 10 &&
              (notificationEscalation.bentleyCriticalEscalationCount ?? 0) < 3,
            detail: [
              notificationEscalation.bentleyNotificationSummaryLine,
              notificationEscalation.bentleyLastNotificationRunLine,
            ]
              .filter(Boolean)
              .join(" — ")
              .slice(0, 400),
          } satisfies LaunchReadinessRow,
        ]
      : []),
    ...(autonomousGuidance &&
    (autonomousGuidance.bentleyAutonomousActionSummaryLine ||
      autonomousGuidance.bentleyApprovalRequiredCount != null ||
      autonomousGuidance.bentleyPendingApprovalCount != null)
      ? [
          {
            id: "autonomous_operator",
            label: "Autonomous operator",
            ok:
              (autonomousGuidance.bentleyPendingApprovalCount ??
                autonomousGuidance.bentleyApprovalRequiredCount ??
                0) < 5 &&
              (autonomousGuidance.bentleyAutonomousFailureCount ?? 0) < 2,
            detail: [
              autonomousGuidance.bentleyApprovalQueueSummaryLine,
              autonomousGuidance.bentleyAuditTrailSummaryLine,
              autonomousGuidance.bentleyAutonomousActionSummaryLine,
              autonomousGuidance.bentleyTopApprovalRequestLine,
            ]
              .filter(Boolean)
              .join(" — ")
              .slice(0, 400),
          } satisfies LaunchReadinessRow,
        ]
      : []),
  ];

  const workflowPipelineOk =
    rowResearch.ok &&
    rowTrends.ok &&
    rowMarketSweep.ok &&
    rowContent.ok &&
    rowCampaign.ok &&
    rowBrief.ok &&
    rowAnalysis.ok;

  let finalKind: LaunchReadinessFinalKind = "ready";
  let headline = "Ready to launch";
  let subline =
    "Review your bundle in Launch Campaign — nothing publishes until you confirm there.";

  if (!workflowPipelineOk || !rowPosting.ok) {
    finalKind = "blocked_workflow";
    headline = "Blocked by incomplete workflow";
    if (!rowPosting.ok) {
      subline = "Finish Bentley pipeline steps and select posting platforms in guided intake.";
    } else {
      subline = "Complete the remaining Revenue OS pipeline steps (research through full analysis).";
    }
  } else if (!rowOAuth.ok) {
    finalKind = "blocked_connection";
    headline = "Blocked by missing connection";
    subline = "Connect OAuth for each selected platform under Workspace integrations.";
  } else if (!rowAsset.ok) {
    finalKind = "blocked_content";
    headline = "Blocked by missing draft/content";
    subline = "Produce viral content output and save a first-campaign draft, or use the generated bundle.";
  }

  return { rows, finalKind, headline, subline };
}
