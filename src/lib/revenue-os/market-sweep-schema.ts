/**
 * Shared types for Market Intelligence Sweep, experiments, distribution, and growth guidance.
 * (Runtime logic lives in sweep pipeline modules; this file is types-only.)
 */

import type { LeadSignalSummary } from "@/lib/revenue-os/lead-signal-summary";

export type ContentGenerationMode = "scale_winners" | "iterate_messaging" | "research_first" | "balanced";

export type SignalConfidence = "high" | "medium" | "low";

export type ScoredInsightSource =
  | "merged"
  | "llm"
  | "reddit"
  | "youtube"
  | "tiktok"
  | "google"
  | string;

export type ScoredInsight = {
  text: string;
  score: number;
  confidence: SignalConfidence;
  frequency: number;
  source: ScoredInsightSource;
  recencyWeight: number;
  sourceTrustWeight: number;
  commercialIntentWeight: number;
  feedbackPerformanceWeight: number;
};

export type SweepBucketKey =
  | "trendingTopics"
  | "viralHooks"
  | "painPoints"
  | "buyingSignals"
  | "commentInsights"
  | "competitorAngles"
  | "contentGaps";

export type ScoredInsightsBuckets = Partial<Record<SweepBucketKey, ScoredInsight[]>>;

export type MarketIntelligenceDiff = {
  hasPrior: boolean;
  newTopics: string[];
  droppedTopics: string[];
  strengthenedHooks: string[];
  weakenedHooks: string[];
  summary: string;
};

export type MarketSweepHybridMeta = {
  realSignalCount: number;
  sourcesConnected: string[];
  connectorErrors?: string[];
};

export type MarketSweepNextAction = {
  action: "run_sweep" | "double_down_content" | "iterate_messaging" | "pause_and_research" | "continue_pipeline";
  reason: string;
  priority: number;
};

export type ExperimentPlanVariant = {
  variantKey: string;
  hookType: string;
  angle: string;
  ctaType: string;
  framingStyle: string;
  platform: string;
  contentType: string;
};

export type MarketSweepExperimentPlan = {
  hypothesis: string;
  experimentTheme: string;
  primaryMetric: string;
  recommendedPlatforms: string[];
  variants: ExperimentPlanVariant[];
  experimentId?: string;
  variantIdsByKey?: Record<string, string>;
};

export type DistributionPlanItem = {
  angle: string;
  rationale: string;
  platform: string;
  contentType: string;
  /** Optional experiment / sweep cell key when persisting distribution queue rows. */
  variantKey?: string;
  hookType?: string;
  publishPriority?: number;
  targetFormat?: string;
  ctaType?: string;
};

export type BentleyDistributionPlan = {
  summary: string;
  launchNow: DistributionPlanItem[];
  testNext: DistributionPlanItem[];
  holdBack: DistributionPlanItem[];
  platformFormatHints: string[];
};

export type NotificationEscalationGuidance = {
  bentleyNotificationSummaryLine?: string;
  bentleyCriticalEscalationCount?: number;
  bentleyUnreadInAppCount?: number;
  bentleyLastNotificationRunLine?: string;
  bentleyTopEscalationTargetLine?: string;
};

export type AutonomousActionGuidance = {
  bentleyAutonomousActionSummaryLine?: string;
  bentleyAutoExecutedCount?: number;
  bentleyApprovalRequiredCount?: number;
  bentleyAutonomousFailureCount?: number;
  bentleyTopApprovalRequestLine?: string;
  bentleyPendingApprovalCount?: number;
  bentleyExpiringApprovalCount?: number;
  bentleyRecentAutonomousExecutionLine?: string;
  bentleyRecentAutonomousFailureLine?: string;
  bentleyApprovalQueueSummaryLine?: string;
  bentleyAuditTrailSummaryLine?: string;
};

/** Operator-facing guidance — required narrative plus many optional operational overlays. */
export type GrowthGuidance = {
  recommendedNextMove: string;
  why: string;
  risingTopics: string[];
  weakAngles: string[];
  bestHookDirection: string;
  leadSignalSummaryLine?: string;
  dominantObjectionCluster?: string | null;
  bentleyNextResponseMode?: string;
  workflowSummary?: string;
  approvalBottleneckLine?: string;
  publishFailureLine?: string;
  unsyncedMetricLine?: string;
  handoffBacklogLine?: string;
  bentleyOperationalNextStep?: string;
  connectorCoverageSummary?: string;
  autoPublishReadyCount?: number;
  manualFallbackCount?: number;
  blockedTargetsCount?: number;
  recommendedConnectorAction?: string;
  cadenceSummary?: string;
  cadencePromotionCount?: number;
  cadenceSuppressionCount?: number;
  cadenceRetryCount?: number;
  cadenceStaleCount?: number;
  cadenceRetestRecommendationCount?: number;
  cadenceNextSchedulerAction?: string;
  /** Optional health / workspace highlights from sweep pipeline JSON. */
  systemHealthScore?: number;
  topUrgentWorkspace?: string;
  topOpportunityWorkspace?: string;
  operatorActionSummary?: string;
  leadHandoffBacklogSummary?: string;
  connectorGapSummary?: string;
  publishFailureSummary?: string;
  bentleyCriticalExceptionCount?: number;
  bentleyTopEscalationLine?: string;
  bentleyOverdueAutomationSummary?: string;
  bentleyNextScheduledAutomationLine?: string;
  bentleyReportStatusLine?: string;
  bentleyNotificationSummaryLine?: string;
  bentleyCriticalEscalationCount?: number;
  bentleyUnreadInAppCount?: number;
  bentleyLastNotificationRunLine?: string;
  bentleyTopEscalationTargetLine?: string;
  bentleyAutonomousActionSummaryLine?: string;
  bentleyAutoExecutedCount?: number;
  bentleyApprovalRequiredCount?: number;
  bentleyAutonomousFailureCount?: number;
  bentleyTopApprovalRequestLine?: string;
  bentleyPendingApprovalCount?: number;
  bentleyExpiringApprovalCount?: number;
  bentleyRecentAutonomousExecutionLine?: string;
  bentleyRecentAutonomousFailureLine?: string;
  bentleyApprovalQueueSummaryLine?: string;
  bentleyAuditTrailSummaryLine?: string;
  bentleyExplainabilitySummaryLine?: string;
  bentleyTopDecisionRationaleLine?: string;
  bentleySimulationSummaryLine?: string;
  bentleyPolicyDeltaRiskLine?: string;
  bentleyPolicyWorkbenchSummaryLine?: string;
  bentleyTopScenarioRecommendationLine?: string;
  bentleyScenarioRiskSummaryLine?: string;
  bentleyScenarioCompareSummaryLine?: string;
  bentleyScenarioPresetRecommendationLine?: string;
  bentleyApplyReviewSummaryLine?: string;
  bentleyRolloutSummaryLine?: string;
  bentleyPilotWorkspaceRecommendationLine?: string;
  bentleyRolloutRiskLine?: string;
  bentleyRollbackTriggerLine?: string;
  bentleyRolloutMonitoringSummaryLine?: string;
  bentleyRolloutStageHealthLine?: string;
  bentleyRolloutNextActionLine?: string;
  bentleyRollbackRecommendedLine?: string;
  bentleyRollbackPackageSummaryLine?: string;
  bentleyRollbackBundleReadyLine?: string;
  bentleyRollbackApplyAdvisoryLine?: string;
  bentleyDeploymentHistorySummaryLine?: string;
  bentleyLatestDeploymentOutcomeLine?: string;
  bentleyLinkedRollbackAvailabilityLine?: string;
  distributionPlanSummary?: string;
};

export type MarketSweepResult = {
  trendingTopics: string[];
  viralHooks: string[];
  painPoints: string[];
  buyingSignals: string[];
  commentInsights: string[];
  competitorAngles: string[];
  contentGaps: string[];
  hybridMeta?: MarketSweepHybridMeta;
  disclaimers?: string[];
  realSignalsSummary?: string;
  scoredInsights?: ScoredInsightsBuckets;
  nextAction?: MarketSweepNextAction;
  contentGenerationMode?: ContentGenerationMode;
  growthGuidance?: GrowthGuidance;
  intelligenceDiff?: MarketIntelligenceDiff | null;
  experimentPlan?: MarketSweepExperimentPlan | null;
  experimentPlanSkippedReason?: string;
  distributionPlan?: BentleyDistributionPlan | null;
  leadSignalSummary?: LeadSignalSummary | null;
};
