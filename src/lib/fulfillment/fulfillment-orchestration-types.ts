import type {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

/** Active fulfillment departments — governed orchestration; no autonomous launch from fulfillment layer. */
export type FulfillmentDepartmentKey =
  | typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE
  | typeof FULFILLMENT_PRIMARY_SERVICE_TRUST
  | typeof FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS;

export const FULFILLMENT_ORCHESTRATION_DEPARTMENTS = ["WEBSITE", "TRUST", "REVENUE_OS"] as const;

export type FulfillmentOrchestrationDepartment = (typeof FULFILLMENT_ORCHESTRATION_DEPARTMENTS)[number];

export type AdvisoryDepartmentKey = "AI_REVENUE_OS";

export type CrossDepartmentDependencyKind =
  | "soft_prerequisite"
  | "parallel_safe"
  | "downstream_benefit"
  | "informational";

export type CrossDepartmentDependency = {
  from: FulfillmentOrchestrationDepartment | AdvisoryDepartmentKey;
  to: FulfillmentOrchestrationDepartment | AdvisoryDepartmentKey;
  kind: CrossDepartmentDependencyKind;
  summary: string;
  /** When true, fulfillment in `to` may proceed but quality/coordination improves if `from` is further along. */
  optional: boolean;
};

export type ClientOperationsGraphNodeKind =
  | "client"
  | "fulfillment_order"
  | "payment_confirmation"
  | "deliverable"
  | "campaign_signal";

export type ClientOperationsGraphNode = {
  id: string;
  kind: ClientOperationsGraphNodeKind;
  label: string;
  department: FulfillmentOrchestrationDepartment | AdvisoryDepartmentKey | null;
  meta?: Record<string, string | number | boolean | null>;
};

export type ClientOperationsGraphEdgeKind =
  | "owns_order"
  | "paid_by"
  | "deliverable_for"
  | "depends_on"
  | "relates_to"
  | "blocks_progress";

export type ClientOperationsGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: ClientOperationsGraphEdgeKind;
  label: string;
};

export type ClientOperationsGraph = {
  clientId: string;
  nodes: ClientOperationsGraphNode[];
  edges: ClientOperationsGraphEdge[];
  multiOrderRelationships: MultiOrderRelationship[];
};

export type MultiOrderRelationshipKind =
  | "same_client"
  | "sequencing_hint"
  | "shared_payment_window"
  | "cross_department_coordination";

export type MultiOrderRelationship = {
  kind: MultiOrderRelationshipKind;
  orderIds: string[];
  departments: FulfillmentOrchestrationDepartment[];
  summary: string;
};

export type UnifiedTimelineEntryKind =
  | "payment_confirmed"
  | "payment_consumed"
  | "claude_handoff"
  | "stage_transition"
  | "approval_pending"
  | "approval_executed"
  | "deliverable_review"
  | "client_delivery"
  | "orchestration_note";

export type UnifiedTimelineEntry = {
  id: string;
  kind: UnifiedTimelineEntryKind;
  label: string;
  occurredAt: string;
  department: FulfillmentOrchestrationDepartment | null;
  orderId: string | null;
  detail: string | null;
};

export type DepartmentReadinessSnapshot = {
  department: FulfillmentOrchestrationDepartment;
  tier: "weak" | "medium" | "strong";
  score: number;
  fulfillmentReady: boolean;
  summaryExcerpt: string | null;
};

export type SharedClientReadinessSummary = {
  clientId: string;
  departments: DepartmentReadinessSnapshot[];
  overallFulfillmentReady: boolean;
  weakestDepartment: FulfillmentOrchestrationDepartment | null;
  narrative: string;
};

export type FulfillmentRecommendationKind =
  | "engage_department"
  | "sequence_next"
  | "resolve_bottleneck"
  | "cross_sell_advisory"
  | "stall_recovery"
  | "approval_review"
  | "payment_gate"
  | "monitor_only";

export type FulfillmentRecommendation = {
  id: string;
  kind: FulfillmentRecommendationKind;
  department: FulfillmentOrchestrationDepartment | AdvisoryDepartmentKey | null;
  priority: "low" | "normal" | "high";
  title: string;
  rationale: string;
  /** Recommendations never auto-execute — human desk action required. */
  requiresHumanAction: true;
  relatedOrderIds: string[];
};

export type CrossSellOpportunity = {
  id: string;
  target: AdvisoryDepartmentKey | FulfillmentOrchestrationDepartment;
  title: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
  /** Advisory only — no automatic billing or order creation. */
  advisoryOnly: true;
};

export type FulfillmentSequencingRecommendation = {
  recommendedOrder: FulfillmentOrchestrationDepartment[];
  rationale: string;
  blockedBy: FulfillmentOrchestrationDepartment[];
};

export type OperationalBottleneck = {
  id: string;
  department: FulfillmentOrchestrationDepartment;
  stage: string;
  orderCount: number;
  summary: string;
};

export type ClientHealthTier = "critical" | "at_risk" | "steady" | "healthy";

export type ClientHealthScore = {
  clientId: string;
  score: number;
  tier: ClientHealthTier;
  stalled: boolean;
  stallReasons: string[];
  factors: Array<{ key: string; label: string; impact: number; detail: string }>;
};

export type ClientFulfillmentOrderSnapshot = {
  orderId: string;
  clientId: string;
  department: FulfillmentOrchestrationDepartment;
  assignedDepartment: string;
  pipelineStage: string;
  approvalStatus: "none" | "pending" | "approved" | "rejected" | "executed" | "failed";
  ownerReviewStatus: "pending" | "approved" | "rejected" | null;
  paymentStatus: "pending" | "confirmed" | "failed";
  paymentConsumed: boolean;
  createdAt: string;
  updatedAt: string | null;
  daysInCurrentStage: number;
  /** REVENUE_OS handoff — campaign linkage for orchestration graph. */
  campaignId?: string | null;
  launchReadinessApproved?: boolean;
  revisionRound?: number;
};

export type ClientFulfillmentOperationsDto = {
  ok: true;
  clientId: string;
  generatedAt: string;
  graph: ClientOperationsGraph;
  readiness: SharedClientReadinessSummary;
  health: ClientHealthScore;
  timeline: UnifiedTimelineEntry[];
  recommendations: FulfillmentRecommendation[];
  crossSellOpportunities: CrossSellOpportunity[];
  sequencing: FulfillmentSequencingRecommendation;
  dependencies: {
    websiteDependsOnTrust: boolean;
    trustDependsOnWebsite: boolean;
    revenueOsDependsOnWebsite: boolean;
    websiteBenefitsFromRevenueOs: boolean;
    narrative: string;
  };
  orders: ClientFulfillmentOrderSnapshot[];
  meta: {
    recommendationOnly: true;
    noAutonomousExecution: true;
  };
  skipperBrief: string;
  timelineSummary: string;
};

export type ExecutiveFulfillmentOperationsOverviewDto = {
  ok: true;
  generatedAt: string;
  totals: {
    activeOrders: number;
    stalledClients: number;
    pendingApprovals: number;
    websiteOrders: number;
    trustOrders: number;
    revenueOsOrders: number;
  };
  bottlenecks: OperationalBottleneck[];
  clients: Array<{
    clientId: string;
    healthScore: number;
    healthTier: ClientHealthTier;
    stalled: boolean;
    activeDepartments: FulfillmentOrchestrationDepartment[];
    topRecommendation: string | null;
  }>;
  meta: {
    recommendationOnly: true;
    noAutonomousExecution: true;
  };
};
