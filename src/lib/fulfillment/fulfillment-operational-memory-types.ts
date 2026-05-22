import type { FulfillmentOrchestrationDepartment, FulfillmentRecommendationKind } from "@/lib/fulfillment/fulfillment-orchestration-types";

export type OperationalMemoryOrderRecord = {
  orderId: string;
  clientId: string;
  department: FulfillmentOrchestrationDepartment;
  pipelineStage: string;
  approvalStatus: "none" | "pending" | "approved" | "rejected" | "executed" | "failed";
  ownerReviewStatus: "pending" | "approved" | "rejected";
  clientDeliveryStatus: "not_sent" | "workspace_active" | "client_approved" | "client_revision_requested";
  draftVersion: number;
  daysInCurrentStage: number;
  paymentConsumed: boolean;
  updatedAt: string | null;
  createdAt: string | null;
};

export type FulfillmentOutcomeKind =
  | "progressing"
  | "client_approved"
  | "revision_heavy"
  | "owner_review_stalled"
  | "approval_blocked"
  | "trust_packet_stalled"
  | "website_draft_low_revision"
  | "revenue_os_launch_blocked"
  | "revenue_os_campaign_stalled"
  | "revenue_os_kpi_watch";

export type FulfillmentOutcomeRecord = {
  orderId: string;
  clientId: string;
  department: FulfillmentOrchestrationDepartment;
  outcome: FulfillmentOutcomeKind;
  revisionCount: number;
  daysInStage: number;
  summary: string;
};

export type RecommendationEffectivenessSignal = {
  kind: FulfillmentRecommendationKind;
  sampleCount: number;
  /** 0–1 — higher means historically associated with forward progress */
  effectivenessScore: number;
  insight: string;
};

export type OperatorPriorityPattern = {
  actionKey: string;
  label: string;
  occurrenceCount: number;
  shareOfDeskActivity: number;
};

export type BottleneckRecurrenceRecord = {
  id: string;
  department: FulfillmentOrchestrationDepartment;
  stage: string;
  currentOrderCount: number;
  recurrenceScore: number;
  repeatVisits: number;
  summary: string;
};

export type ApprovalLatencyRecord = {
  proposedAction: string;
  department: FulfillmentOrchestrationDepartment | null;
  sampleCount: number;
  medianHoursToExecute: number | null;
  fastestHours: number | null;
  slowestHours: number | null;
};

export type ClientLifecycleInsight = {
  clientId: string;
  guidanceScore: number;
  revisionBurden: "low" | "medium" | "high";
  departmentsActive: FulfillmentOrchestrationDepartment[];
  insight: string;
};

export type FulfillmentSuccessScoreRecord = {
  orderId: string;
  clientId: string;
  department: FulfillmentOrchestrationDepartment;
  score: number;
  tier: "excellent" | "good" | "at_risk" | "critical";
  factors: string[];
};

export type RecommendationMemoryWeights = Partial<
  Record<FulfillmentRecommendationKind, number>
>;

export type OperationalMemoryStoreSnapshot = {
  ordersAnalyzed: number;
  outcomes: FulfillmentOutcomeRecord[];
  recommendationSignals: RecommendationEffectivenessSignal[];
  operatorPatterns: OperatorPriorityPattern[];
  bottleneckRecurrence: BottleneckRecurrenceRecord[];
  approvalLatency: ApprovalLatencyRecord[];
  clientLifecycle: ClientLifecycleInsight[];
  successScores: FulfillmentSuccessScoreRecord[];
  recommendationWeights: RecommendationMemoryWeights;
  learnedAt: string;
};

export type ExecutiveFulfillmentOperationalMemoryInsightsDto = {
  ok: true;
  generatedAt: string;
  headline: string;
  skipperSummary: string;
  memory: OperationalMemoryStoreSnapshot;
  highlights: {
    websiteLowRevisionDrafts: number;
    trustStalledPackets: number;
    revenueOsLaunchBlocked: number;
    revenueOsCampaignStalled: number;
    clientsNeedingGuidance: number;
    fastestApprovalFlow: string | null;
    topEffectiveRecommendation: string | null;
    recurringBottleneck: string | null;
    topOwnerPriority: string | null;
  };
  revisionAnalytics: {
    websiteAvgDraftVersion: number;
    websiteRevisionRequestedRate: number;
    trustOwnerReviewPendingRate: number;
    topRevisionThemes: string[];
  };
  meta: {
    recommendationOnly: true;
    noAutonomousExecution: true;
    noAutonomousLearningActions: true;
    readOnlyAnalytics: true;
  };
};

export type OperationalMemoryBuildInput = {
  orders: OperationalMemoryOrderRecord[];
  revisionEventCounts: Map<string, number>;
  approvals: Array<{
    id: string;
    proposedAction: string;
    targetId: string | null;
    status: string;
    createdAt: string | null;
    executedAt: string | null;
    department: FulfillmentOrchestrationDepartment | null;
  }>;
  auditActions: Array<{ actionType: string; toolName: string }>;
  memoryItemTitles: string[];
};
