/**
 * Derives operator-facing growth guidance from sweep + feedback + diff + next action.
 */

import type { MarketIntelligenceDiff } from "@/lib/revenue-os/market-sweep-schema";
import type { FeedbackAggregationResult } from "@/lib/revenue-os/feedback-aggregation";
import type { NextActionDecision } from "@/lib/revenue-os/decision-engine";
import type {
  AutonomousActionGuidance,
  GrowthGuidance,
  MarketSweepResult,
} from "@/lib/revenue-os/market-sweep-schema";
import type { WorkflowOperationalGuidance } from "@/lib/revenue-os/publishing-workflow";
import type { ProactiveAutomationGuidance } from "@/lib/revenue-os/proactive-automation-guidance";
import type { NotificationEscalationGuidance } from "@/lib/revenue-os/market-sweep-schema";

export function buildGrowthGuidance(input: {
  sweep: MarketSweepResult;
  feedback: FeedbackAggregationResult;
  diff: MarketIntelligenceDiff;
  nextAction: NextActionDecision;
  /** When provided (e.g. after loading queue state), merged into guidance. */
  workflowOperational?: WorkflowOperationalGuidance | null;
  /** Optional — proactive automation / exception lines (Bentley OS). */
  proactiveAutomation?: ProactiveAutomationGuidance | null;
  /** Optional — notification + escalation summary. */
  notificationEscalation?: NotificationEscalationGuidance | null;
  /** Optional — policy-governed autonomous operator summary. */
  autonomousGuidance?: AutonomousActionGuidance | null;
  /** Optional — explainability / simulation one-liners merged into guidance. */
  explainabilityOverlay?: {
    bentleyExplainabilitySummaryLine?: string;
    bentleyTopDecisionRationaleLine?: string;
    bentleySimulationSummaryLine?: string;
    bentleyPolicyDeltaRiskLine?: string;
  } | null;
  /** Optional — policy workbench / scenario compare one-liners. */
  policyWorkbenchOverlay?: {
    bentleyPolicyWorkbenchSummaryLine?: string;
    bentleyTopScenarioRecommendationLine?: string;
    bentleyScenarioRiskSummaryLine?: string;
    bentleyScenarioCompareSummaryLine?: string;
    bentleyScenarioPresetRecommendationLine?: string;
    bentleyApplyReviewSummaryLine?: string;
  } | null;
  /** Optional — staged policy rollout coaching one-liners. */
  rolloutOverlay?: {
    bentleyRolloutSummaryLine?: string;
    bentleyPilotWorkspaceRecommendationLine?: string;
    bentleyRolloutRiskLine?: string;
    bentleyRollbackTriggerLine?: string;
  } | null;
  /** Optional — saved-plan rollout monitoring (operational). */
  rolloutMonitoringOverlay?: {
    bentleyRolloutMonitoringSummaryLine?: string;
    bentleyRolloutStageHealthLine?: string;
    bentleyRolloutNextActionLine?: string;
    bentleyRollbackRecommendedLine?: string;
  } | null;
  /** Optional — explicit rollback packages (workbench). */
  rollbackPackageOverlay?: {
    bentleyRollbackPackageSummaryLine?: string;
    bentleyRollbackBundleReadyLine?: string;
    bentleyRollbackApplyAdvisoryLine?: string;
  } | null;
  /** Optional — coordinated policy deployments (change sets). */
  deploymentOverlay?: {
    bentleyDeploymentHistorySummaryLine?: string;
    bentleyLatestDeploymentOutcomeLine?: string;
    bentleyLinkedRollbackAvailabilityLine?: string;
  } | null;
}): GrowthGuidance {
  const { sweep, feedback, diff, nextAction } = input;

  const rising = uniq([
    ...diff.newTopics,
    ...feedback.topPerformingTopics.slice(0, 4),
    ...(sweep.trendingTopics ?? []).slice(0, 2),
  ]).slice(0, 8);

  const weak = uniq([
    ...diff.droppedTopics,
    ...diff.weakenedHooks,
    ...feedback.underperformingTopics.slice(0, 4),
    ...(sweep.competitorAngles ?? []).slice(0, 1),
  ]).slice(0, 8);

  const hookDir =
    feedback.topPerformingHookTypes[0] ??
    (sweep.viralHooks?.[0] ? `Lean into patterns like: ${sweep.viralHooks[0].slice(0, 80)}` : "POV + specificity beats generic advice");

  const recommendedNextMove =
    nextAction.action === "double_down_content"
      ? "Scale creative on the strongest corroborated themes and hook types."
      : nextAction.action === "iterate_messaging"
        ? "Run messaging experiments away from weak angles before increasing volume."
        : nextAction.action === "pause_and_research"
          ? "Validate live signal sources and refresh positioning before spend."
          : nextAction.action === "run_sweep"
            ? "Re-run positioning and sweep with updated brief inputs."
            : "Continue pipeline with monitored feedback loops.";

  const lb = feedback.leadSignalBias;
  let extraWhy = "";
  let leadSignalSummaryLine: string | undefined;
  let dominantObjectionCluster: string | null | undefined;
  let bentleyNextResponseMode: string | undefined;

  if (lb && lb.totalSignals > 0) {
    leadSignalSummaryLine = `${lb.totalSignals} lead signal(s); objections ${lb.objectionClusterCount}, high-intent ${lb.highIntentCount}, handoff-ready ${lb.handoffReadyCount}.`;
    dominantObjectionCluster = lb.dominantObjectionTopic ?? null;
    if (lb.objectionClusterCount >= 2 && lb.highIntentCount < lb.objectionClusterCount) {
      bentleyNextResponseMode = "educate_objection_handling";
      extraWhy += " Lead intent: objection clusters — bias toward educate and objection-handling.";
    } else if (lb.highIntentCount >= 3) {
      bentleyNextResponseMode = "convert_cta_forward";
      extraWhy += " Lead intent: high commercial intent — bias toward convert / CTA-forward.";
    } else if (lb.trustSeekingCount >= 2) {
      bentleyNextResponseMode = "testimonial_proof";
      extraWhy += " Lead intent: trust/proof seeking — emphasize testimonials and case-study angles.";
    } else if (lb.handoffReadyCount >= 3) {
      bentleyNextResponseMode = "lead_capture_first";
      extraWhy += " Lead intent: handoff-ready volume — prioritize lead capture and sales-support assets.";
    }
  }

  const why = [
    nextAction.reason,
    diff.hasPrior ? diff.summary : "First snapshot in this configuration.",
    feedback.feedbackCount > 0
      ? `Feedback: ${feedback.feedbackCount} row(s), pos ratio ${feedback.positiveSentimentRatio.toFixed(2)}, neg ${feedback.negativeSentimentRatio.toFixed(2)}.`
      : "No stored feedback yet — rely on live signals and LLM synthesis.",
    extraWhy.trim() || undefined,
  ]
    .filter(Boolean)
    .join(" ");

  const wo = input.workflowOperational;
  const whyWithWorkflow = wo?.workflowSummary ? `${why} ${wo.workflowSummary}`.slice(0, 4500) : why;

  const cc = wo?.connectorCoverageSummary;
  const pa = input.proactiveAutomation;
  const ne = input.notificationEscalation;
  const au = input.autonomousGuidance;
  const ex = input.explainabilityOverlay;
  const pw = input.policyWorkbenchOverlay;
  const ro = input.rolloutOverlay;
  const rm = input.rolloutMonitoringOverlay;
  const rpx = input.rollbackPackageOverlay;
  const dep = input.deploymentOverlay;

  return {
    recommendedNextMove,
    why: whyWithWorkflow,
    risingTopics: rising,
    weakAngles: weak,
    bestHookDirection: hookDir,
    leadSignalSummaryLine,
    dominantObjectionCluster,
    bentleyNextResponseMode,
    workflowSummary: wo?.workflowSummary,
    approvalBottleneckLine: wo?.approvalBottleneckLine,
    publishFailureLine: wo?.publishFailureLine,
    unsyncedMetricLine: wo?.unsyncedMetricLine,
    handoffBacklogLine: wo?.handoffBacklogLine,
    bentleyOperationalNextStep: wo?.bentleyOperationalNextStep,
    connectorCoverageSummary: wo?.connectorSummaryLine ?? cc?.matrixSummaryLine,
    autoPublishReadyCount: cc?.autoPublishReadyCount,
    manualFallbackCount: cc?.manualFallbackCount,
    blockedTargetsCount: cc?.blockedTargetsCount,
    recommendedConnectorAction: cc?.recommendedConnectorAction,
    cadenceSummary: wo?.cadenceSummary,
    cadencePromotionCount: wo?.cadencePromotionCount,
    cadenceSuppressionCount: wo?.cadenceSuppressionCount,
    cadenceRetryCount: wo?.cadenceRetryCount,
    cadenceStaleCount: wo?.cadenceStaleCount,
    cadenceRetestRecommendationCount: wo?.cadenceRetestRecommendationCount,
    cadenceNextSchedulerAction: wo?.cadenceNextAction,
    bentleyCriticalExceptionCount: pa?.criticalExceptionCount,
    bentleyTopEscalationLine: pa?.topEscalationLine,
    bentleyOverdueAutomationSummary: pa?.overdueAutomationSummary,
    bentleyNextScheduledAutomationLine: pa?.nextScheduledAutomationLine,
    bentleyReportStatusLine: pa?.reportStatusLine,
    bentleyNotificationSummaryLine: ne?.bentleyNotificationSummaryLine,
    bentleyCriticalEscalationCount: ne?.bentleyCriticalEscalationCount,
    bentleyUnreadInAppCount: ne?.bentleyUnreadInAppCount,
    bentleyLastNotificationRunLine: ne?.bentleyLastNotificationRunLine,
    bentleyTopEscalationTargetLine: ne?.bentleyTopEscalationTargetLine,
    bentleyAutonomousActionSummaryLine: au?.bentleyAutonomousActionSummaryLine,
    bentleyAutoExecutedCount: au?.bentleyAutoExecutedCount,
    bentleyApprovalRequiredCount: au?.bentleyApprovalRequiredCount,
    bentleyAutonomousFailureCount: au?.bentleyAutonomousFailureCount,
    bentleyTopApprovalRequestLine: au?.bentleyTopApprovalRequestLine,
    bentleyPendingApprovalCount: au?.bentleyPendingApprovalCount,
    bentleyExpiringApprovalCount: au?.bentleyExpiringApprovalCount,
    bentleyRecentAutonomousExecutionLine: au?.bentleyRecentAutonomousExecutionLine,
    bentleyRecentAutonomousFailureLine: au?.bentleyRecentAutonomousFailureLine,
    bentleyApprovalQueueSummaryLine: au?.bentleyApprovalQueueSummaryLine,
    bentleyAuditTrailSummaryLine: au?.bentleyAuditTrailSummaryLine,
    bentleyExplainabilitySummaryLine: ex?.bentleyExplainabilitySummaryLine,
    bentleyTopDecisionRationaleLine: ex?.bentleyTopDecisionRationaleLine,
    bentleySimulationSummaryLine: ex?.bentleySimulationSummaryLine,
    bentleyPolicyDeltaRiskLine: ex?.bentleyPolicyDeltaRiskLine,
    bentleyPolicyWorkbenchSummaryLine: pw?.bentleyPolicyWorkbenchSummaryLine,
    bentleyTopScenarioRecommendationLine: pw?.bentleyTopScenarioRecommendationLine,
    bentleyScenarioRiskSummaryLine: pw?.bentleyScenarioRiskSummaryLine,
    bentleyScenarioCompareSummaryLine: pw?.bentleyScenarioCompareSummaryLine,
    bentleyScenarioPresetRecommendationLine: pw?.bentleyScenarioPresetRecommendationLine,
    bentleyApplyReviewSummaryLine: pw?.bentleyApplyReviewSummaryLine,
    bentleyRolloutSummaryLine: ro?.bentleyRolloutSummaryLine,
    bentleyPilotWorkspaceRecommendationLine: ro?.bentleyPilotWorkspaceRecommendationLine,
    bentleyRolloutRiskLine: ro?.bentleyRolloutRiskLine,
    bentleyRollbackTriggerLine: ro?.bentleyRollbackTriggerLine,
    bentleyRolloutMonitoringSummaryLine: rm?.bentleyRolloutMonitoringSummaryLine,
    bentleyRolloutStageHealthLine: rm?.bentleyRolloutStageHealthLine,
    bentleyRolloutNextActionLine: rm?.bentleyRolloutNextActionLine,
    bentleyRollbackRecommendedLine: rm?.bentleyRollbackRecommendedLine,
    bentleyRollbackPackageSummaryLine: rpx?.bentleyRollbackPackageSummaryLine,
    bentleyRollbackBundleReadyLine: rpx?.bentleyRollbackBundleReadyLine,
    bentleyRollbackApplyAdvisoryLine: rpx?.bentleyRollbackApplyAdvisoryLine,
    bentleyDeploymentHistorySummaryLine: dep?.bentleyDeploymentHistorySummaryLine,
    bentleyLatestDeploymentOutcomeLine: dep?.bentleyLatestDeploymentOutcomeLine,
    bentleyLinkedRollbackAvailabilityLine: dep?.bentleyLinkedRollbackAvailabilityLine,
  };
}

function uniq(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of arr) {
    const k = x.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
