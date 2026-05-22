import type {
  ClientHealthTier,
  FulfillmentOrchestrationDepartment,
  FulfillmentRecommendation,
  OperationalBottleneck,
} from "@/lib/fulfillment/fulfillment-orchestration-types";

export type ForecastConfidence = "low" | "medium" | "high";

export type ExecutiveKpiMetric = {
  key: string;
  label: string;
  value: number;
  unit: string | null;
  trend: "up" | "down" | "flat" | null;
  evidence: string;
};

export type DepartmentWorkloadSnapshot = {
  department: FulfillmentOrchestrationDepartment;
  activeOrders: number;
  stalledOrders: number;
  pendingApprovals: number;
  avgDaysInStage: number;
  loadIndex: number;
  balanceLabel: "underloaded" | "balanced" | "elevated" | "overloaded";
};

export type FulfillmentVelocitySnapshot = {
  ordersAnalyzed: number;
  progressingCount: number;
  stalledCount: number;
  velocityScore: number;
  avgDaysInStage: number;
  evidence: string;
};

export type OperationalHealthScoreDto = {
  score: number;
  tier: ClientHealthTier;
  factors: Array<{ key: string; label: string; impact: number; detail: string }>;
  evidenceSummary: string;
};

export type ForecastedRiskAlert = {
  id: string;
  severity: "low" | "medium" | "high";
  category:
    | "fulfillment_delay"
    | "workflow_stall"
    | "department_overload"
    | "revision_risk"
    | "approval_bottleneck"
    | "campaign_degradation"
    | "smart_trust_governance"
    | "backlog_growth";
  department: FulfillmentOrchestrationDepartment | null;
  title: string;
  rationale: string;
  confidence: ForecastConfidence;
  confidenceScore: number;
  relatedOrderIds: string[];
  relatedClientIds: string[];
  memoryEvidence: string | null;
  /** Advisory only — no autonomous corrective action. */
  advisoryOnly: true;
};

export type BottleneckForecast = {
  bottleneck: OperationalBottleneck;
  projectedOrderCount: number;
  daysToEscalation: number | null;
  confidence: ForecastConfidence;
  rationale: string;
};

export type RevisionRiskForecast = {
  clientId: string;
  orderIds: string[];
  revisionBurden: "medium" | "high";
  projectedDelayDays: number;
  confidence: ForecastConfidence;
  rationale: string;
  memoryEvidence: string | null;
};

export type ApprovalDelayForecast = {
  proposedAction: string;
  department: FulfillmentOrchestrationDepartment | null;
  pendingCount: number;
  projectedMedianHours: number | null;
  confidence: ForecastConfidence;
  rationale: string;
};

export type FulfillmentDelayForecast = {
  orderId: string;
  clientId: string;
  department: FulfillmentOrchestrationDepartment;
  projectedDelayDays: number;
  stallLikelihood: number;
  confidence: ForecastConfidence;
  rationale: string;
};

export type ExecutiveKpiOverviewDto = {
  ok: true;
  generatedAt: string;
  metrics: ExecutiveKpiMetric[];
  velocity: FulfillmentVelocitySnapshot;
  departmentWorkload: DepartmentWorkloadSnapshot[];
  operationalHealth: OperationalHealthScoreDto;
  totals: {
    activeOrders: number;
    stalledOrders: number;
    pendingApprovals: number;
    revisionHeavyClients: number;
    websiteOrders: number;
    trustOrders: number;
    revenueOsOrders: number;
    smartTrustOrders: number;
  };
  healthByTier: Record<ClientHealthTier, number>;
  meta: {
    forecastingOnly: true;
    recommendationOnly: true;
    noAutonomousExecution: true;
  };
  skipperSummary: string;
};

export type ExecutiveKpiForecastDto = {
  ok: true;
  generatedAt: string;
  operationalHealth: OperationalHealthScoreDto;
  fulfillmentDelays: FulfillmentDelayForecast[];
  bottleneckForecasts: BottleneckForecast[];
  revisionRisks: RevisionRiskForecast[];
  approvalDelays: ApprovalDelayForecast[];
  riskAlerts: ForecastedRiskAlert[];
  forecastAwareRecommendations: FulfillmentRecommendation[];
  projectedBacklog: {
    activeOrders: number;
    projectedStallsNext7d: number;
    confidence: ForecastConfidence;
    evidence: string;
  };
  meta: {
    forecastingOnly: true;
    recommendationOnly: true;
    noAutonomousExecution: true;
    explainable: true;
  };
  skipperSummary: string;
};

export type ExecutiveKpiEngineInput = {
  snapshots: import("@/lib/fulfillment/fulfillment-orchestration-types").ClientFulfillmentOrderSnapshot[];
  bottlenecks: OperationalBottleneck[];
  approvalLatency: import("@/lib/fulfillment/fulfillment-operational-memory-types").ApprovalLatencyRecord[];
  clientLifecycle: import("@/lib/fulfillment/fulfillment-operational-memory-types").ClientLifecycleInsight[];
  outcomes: import("@/lib/fulfillment/fulfillment-operational-memory-types").FulfillmentOutcomeRecord[];
  healthByClient: Array<{
    clientId: string;
    tier: ClientHealthTier;
    score: number;
    stalled: boolean;
  }>;
};
