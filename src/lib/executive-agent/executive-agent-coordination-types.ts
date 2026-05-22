import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { ExecutiveOperationalThreadDto } from "@/lib/executive-agent/executive-conversation-threads";
import type { OperatorWorkloadSnapshot } from "@/lib/executive-agent/executive-operator-types";

export type ExecutiveDeskAgentId = "skipper" | "bentley" | "jarva" | "eleanor" | "reality";

export type CoordinationEvidenceLink = {
  source: "tasks" | "threads" | "operators" | "kpi" | "audit" | "hierarchy" | "inference";
  detail: string;
};

export type AgentCapability = {
  id: string;
  label: string;
  department: FulfillmentOrchestrationDepartment | null;
  requiresApproval: true;
  autonomousExecution: false;
};

export type AgentCapabilityRecord = {
  agentId: ExecutiveDeskAgentId;
  displayName: string;
  domain: string;
  capabilities: AgentCapability[];
  governedOperatorId: string | null;
  canReceiveRoutedTasks: boolean;
  canAutonomouslyExecute: false;
};

export type PersistentAgentWorkspace = {
  agentId: ExecutiveDeskAgentId;
  displayName: string;
  subjectIds: string[];
  activeTasks: number;
  openThreads: number;
  pendingApprovals: number;
  loadIndex: number;
  balanceLabel: "balanced" | "elevated" | "overloaded" | "advisory_only";
  lastActivityAt: string | null;
  evidence: CoordinationEvidenceLink[];
};

export type InterAgentThreadLink = {
  id: string;
  threadId: string;
  title: string;
  sourceAgentId: ExecutiveDeskAgentId;
  targetAgentIds: ExecutiveDeskAgentId[];
  department: FulfillmentOrchestrationDepartment | null;
  clientId: string | null;
  summary: string;
  evidence: CoordinationEvidenceLink[];
};

export type AgentTaskRouteRecommendation = {
  id: string;
  taskId: string;
  taskTitle: string;
  recommendedAgentId: ExecutiveDeskAgentId;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  rationale: string;
  requiresApproval: true;
  approvalAction: "delegateOperationalTask" | "escalateOperationalTask";
  governedOperatorId: string | null;
  evidence: CoordinationEvidenceLink[];
};

export type AgentSpecializationScore = {
  agentId: ExecutiveDeskAgentId;
  score: number;
  matchedCapabilities: string[];
  departmentFit: boolean;
  evidence: CoordinationEvidenceLink[];
};

export type AgentWorkloadBalance = {
  agentId: ExecutiveDeskAgentId;
  loadIndex: number;
  openTasks: number;
  balanceLabel: "balanced" | "elevated" | "overloaded" | "advisory_only";
  rebalanceHint: string | null;
  evidence: CoordinationEvidenceLink[];
};

export type CrossAgentEscalationPath = {
  id: string;
  fromAgentId: ExecutiveDeskAgentId;
  toAgentId: ExecutiveDeskAgentId;
  trigger: string;
  severity: "watch" | "medium" | "high" | "critical";
  requiresApproval: true;
  rationale: string;
  evidence: CoordinationEvidenceLink[];
};

export type AgentApprovalRoute = {
  routingId: string;
  taskId: string;
  targetAgentId: ExecutiveDeskAgentId;
  approvalRequired: true;
  proposedAction: "delegateOperationalTask" | "escalateOperationalTask";
  governedOperatorId: string | null;
  policyChecks: string[];
  rollbackAvailable: true;
};

export type ExecutiveAgentHierarchyNode = {
  agentId: ExecutiveDeskAgentId;
  displayName: string;
  tier: number;
  reportsTo: ExecutiveDeskAgentId | null;
  governsDepartments: FulfillmentOrchestrationDepartment[];
  approvalAuthority: "nexus" | "desk" | "specialist" | "advisory";
};

export type ExecutiveAgentCoordinationEngineInput = {
  tasks: ExecutiveOperationalTaskDto[];
  threads: ExecutiveOperationalThreadDto[];
  operatorWorkload: OperatorWorkloadSnapshot[];
  pendingApprovalCount: number;
};

export type ExecutiveAgentCoordinationOverview = {
  agents: AgentCapabilityRecord[];
  workspaces: PersistentAgentWorkspace[];
  interAgentThreads: InterAgentThreadLink[];
  routeRecommendations: AgentTaskRouteRecommendation[];
  specializationScores: AgentSpecializationScore[];
  workloadBalances: AgentWorkloadBalance[];
  escalationPaths: CrossAgentEscalationPath[];
  hierarchy: ExecutiveAgentHierarchyNode[];
  pendingApprovalRoutes: number;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  skipperSummary: string;
  generatedAt: string;
  meta: {
    explainable: true;
    auditable: true;
    approvalAware: true;
    workloadAware: true;
    evidenceLinked: true;
    hierarchyGoverned: true;
    noUnrestrictedAutonomousExecution: true;
    departmentIsolationPreserved: true;
    rollbackControlsPreserved: true;
    executionPolicyPreserved: true;
  };
};

export type ExecutiveAgentCoordinationOverviewDto = ExecutiveAgentCoordinationOverview & { ok: true };

export type ExecutiveAgentWorkspacesDto = {
  ok: true;
  workspaces: PersistentAgentWorkspace[];
  generatedAt: string;
  meta: ExecutiveAgentCoordinationOverview["meta"];
};

export type AgentTaskRouteRequest = {
  taskId: string;
  targetAgentId: ExecutiveDeskAgentId;
  rationale: string;
  humanConfirmed?: boolean;
};

export type AgentTaskRouteResult = {
  ok: boolean;
  routingId: string;
  recommendation: AgentTaskRouteRecommendation;
  approvalRoute: AgentApprovalRoute;
  approvalProposal?: { approvalId: string; message: string };
  message: string;
};
