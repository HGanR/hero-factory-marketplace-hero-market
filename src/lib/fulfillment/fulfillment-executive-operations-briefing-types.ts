import type {
  ClientFulfillmentOrderSnapshot,
  CrossSellOpportunity,
  FulfillmentOrchestrationDepartment,
  FulfillmentRecommendation,
} from "@/lib/fulfillment/fulfillment-orchestration-types";

export type BriefingOwnerActionPriority = "urgent" | "high" | "normal" | "low";

export type BriefingOwnerActionItem = {
  id: string;
  priority: BriefingOwnerActionPriority;
  title: string;
  rationale: string;
  department: FulfillmentOrchestrationDepartment | "AI_REVENUE_OS" | null;
  clientId: string;
  orderId: string | null;
  kind: FulfillmentRecommendation["kind"] | "owner_review" | "client_review" | "approval_backlog";
  requiresHumanAction: true;
};

export type BriefingStalledOrderItem = {
  orderId: string;
  clientId: string;
  department: FulfillmentOrchestrationDepartment;
  pipelineStage: string;
  daysInStage: number;
  reason: string;
};

export type BriefingStalledClientSummary = {
  clientId: string;
  healthScore: number;
  stallReasons: string[];
  orderIds: string[];
};

export type BriefingApprovalBacklogItem = {
  approvalId: string;
  orderId: string | null;
  clientId: string | null;
  proposedAction: string;
  department: FulfillmentOrchestrationDepartment | null;
  createdAt: string | null;
};

export type BriefingCrossDepartmentOpportunity = {
  clientId: string;
  departments: FulfillmentOrchestrationDepartment[];
  title: string;
  rationale: string;
  websiteDependsOnTrust: boolean;
  trustDependsOnWebsite: boolean;
};

export type BriefingRiskAlert = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  clientId: string | null;
  orderId: string | null;
  department: FulfillmentOrchestrationDepartment | null;
};

export type ExecutiveFulfillmentOperationsBriefingDto = {
  ok: true;
  generatedAt: string;
  briefingDate: string;
  headline: string;
  needsMyAttention: {
    summary: string;
    counts: {
      urgentActions: number;
      stalledOrders: number;
      ownerReviewPending: number;
      clientReviewPending: number;
      approvalBacklog: number;
      crossDepartmentOpportunities: number;
      riskAlerts: number;
    };
  };
  topUrgentActions: BriefingOwnerActionItem[];
  priorityQueue: BriefingOwnerActionItem[];
  stalledClients: BriefingStalledClientSummary[];
  stalledOrders: BriefingStalledOrderItem[];
  ownerReviewPending: Array<{
    orderId: string;
    clientId: string;
    department: FulfillmentOrchestrationDepartment;
    artifactType: string | null;
  }>;
  clientReviewPending: Array<{
    orderId: string;
    clientId: string;
    department: FulfillmentOrchestrationDepartment;
    clientDeliveryStatus: string;
  }>;
  approvalBacklog: BriefingApprovalBacklogItem[];
  crossDepartmentOpportunities: BriefingCrossDepartmentOpportunity[];
  riskAlerts: BriefingRiskAlert[];
  suggestedOwnerSequence: BriefingOwnerActionItem[];
  skipperSummary: string;
  meta: {
    recommendationOnly: true;
    noAutonomousExecution: true;
    activeOrders: number;
    websiteOrders: number;
    trustOrders: number;
  };
};

export type BriefingOrderSnapshot = ClientFulfillmentOrderSnapshot & {
  clientDeliveryStatus:
    | "not_sent"
    | "workspace_active"
    | "client_approved"
    | "client_revision_requested";
};

export type BriefingClientContext = {
  clientId: string;
  orders: BriefingOrderSnapshot[];
  readinessFulfillmentReady: boolean;
  healthScore: number;
  healthTier: string;
  stalled: boolean;
  stallReasons: string[];
  recommendations: FulfillmentRecommendation[];
  crossSellOpportunities: CrossSellOpportunity[];
  websiteDependsOnTrust: boolean;
  trustDependsOnWebsite: boolean;
};

export type BriefingDeskSnapshot = {
  orders: BriefingOrderSnapshot[];
  clients: BriefingClientContext[];
  approvalBacklog: BriefingApprovalBacklogItem[];
  bottlenecks: Array<{ department: FulfillmentOrchestrationDepartment; stage: string; orderCount: number }>;
};
