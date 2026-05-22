import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { ExecutiveOperationalThreadDto } from "@/lib/executive-agent/executive-conversation-threads";

export type WorkflowLifecycleStage =
  | "intake"
  | "coordination"
  | "approval_pending"
  | "approved_execution"
  | "execution_complete"
  | "recovery"
  | "paused"
  | "blocked";

export type WorkflowEvidenceLink = {
  source: "tasks" | "threads" | "approvals" | "audit" | "departments" | "inference";
  detail: string;
};

export type WorkflowStageRecord = {
  stage: WorkflowLifecycleStage;
  label: string;
  status: "complete" | "active" | "pending" | "blocked" | "paused";
  requiresApproval: boolean;
  reversible: boolean;
  evidence: WorkflowEvidenceLink[];
};

export type PersistentWorkflowState = {
  workflowId: string;
  title: string;
  department: FulfillmentOrchestrationDepartment | null;
  clientId: string | null;
  orderId: string | null;
  currentStage: WorkflowLifecycleStage;
  paused: boolean;
  pausedAt: string | null;
  pausedRationale: string | null;
  taskIds: string[];
  threadIds: string[];
  approvalIds: string[];
  stages: WorkflowStageRecord[];
  continuityScore: number;
  evidence: WorkflowEvidenceLink[];
};

export type WorkflowDependencyNode = {
  id: string;
  workflowId: string;
  label: string;
  kind: "task" | "approval" | "thread" | "department_gate";
  dependsOn: string[];
  satisfied: boolean;
  blocksWorkflow: boolean;
};

export type WorkflowDependencyGraph = {
  workflowId: string;
  nodes: WorkflowDependencyNode[];
  hasCycle: boolean;
  blockedNodeIds: string[];
  evidence: WorkflowEvidenceLink[];
};

export type CrossDepartmentWorkflowLink = {
  id: string;
  fromWorkflowId: string;
  toWorkflowId: string;
  fromDepartment: FulfillmentOrchestrationDepartment | null;
  toDepartment: FulfillmentOrchestrationDepartment | null;
  chainKind: "sequential" | "parallel" | "approval_gate";
  requiresApproval: true;
  summary: string;
  evidence: WorkflowEvidenceLink[];
};

export type ApprovalChainStep = {
  order: number;
  approvalId: string | null;
  proposedAction: string | null;
  status: string;
  required: true;
};

export type ApprovalChainOrchestration = {
  workflowId: string;
  steps: ApprovalChainStep[];
  pendingCount: number;
  complete: boolean;
  bypassBlocked: true;
  evidence: WorkflowEvidenceLink[];
};

export type WorkflowRecoveryOption = {
  id: string;
  workflowId: string;
  kind: "resume_stage" | "rollback_approval" | "reopen_task" | "audit_only";
  summary: string;
  requiresApproval: true;
  reversible: true;
  evidence: WorkflowEvidenceLink[];
};

export type WorkflowContinuitySignal = {
  workflowId: string;
  continuityScore: number;
  risk: "stable" | "watch" | "degraded" | "broken";
  gaps: string[];
  evidence: WorkflowEvidenceLink[];
};

export type WorkflowBottleneck = {
  id: string;
  workflowId: string;
  stage: WorkflowLifecycleStage;
  severity: "watch" | "medium" | "high" | "critical";
  summary: string;
  department: FulfillmentOrchestrationDepartment | null;
  evidence: WorkflowEvidenceLink[];
};

export type LifecycleSupervisionRecord = {
  workflowId: string;
  currentStage: WorkflowLifecycleStage;
  supervisionNotes: string[];
  approvalAware: true;
  rollbackAware: true;
  evidence: WorkflowEvidenceLink[];
};

export type ExecutiveWorkflowFabricEngineInput = {
  tasks: ExecutiveOperationalTaskDto[];
  threads: ExecutiveOperationalThreadDto[];
  approvals: Array<{
    id: string;
    proposedAction: string;
    status: string;
    targetId: string | null;
  }>;
  pausedWorkflowIds: Set<string>;
  pauseMetaByWorkflowId: Map<string, { pausedAt: string; rationale: string }>;
};

export type ExecutiveWorkflowFabricOverview = {
  workflows: PersistentWorkflowState[];
  dependencyGraphs: WorkflowDependencyGraph[];
  crossDepartmentLinks: CrossDepartmentWorkflowLink[];
  approvalChains: ApprovalChainOrchestration[];
  recoveryOptions: WorkflowRecoveryOption[];
  continuitySignals: WorkflowContinuitySignal[];
  bottlenecks: WorkflowBottleneck[];
  supervision: LifecycleSupervisionRecord[];
  activeWorkflowCount: number;
  pausedWorkflowCount: number;
  blockedWorkflowCount: number;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  skipperSummary: string;
  generatedAt: string;
  meta: {
    explainable: true;
    auditable: true;
    approvalAware: true;
    dependencyAware: true;
    lifecycleAware: true;
    rollbackAware: true;
    noUnrestrictedAutonomousExecution: true;
    noAutonomousDeploy: true;
    noAutonomousPublish: true;
    noAutonomousSpend: true;
    noAutonomousGovernanceMutation: true;
    noWorkflowApprovalBypass: true;
    departmentIsolationPreserved: true;
  };
};

export type ExecutiveWorkflowFabricOverviewDto = ExecutiveWorkflowFabricOverview & { ok: true };

export type ExecutiveWorkflowDetailDto = {
  ok: true;
  workflow: PersistentWorkflowState;
  dependencyGraph: WorkflowDependencyGraph;
  approvalChain: ApprovalChainOrchestration;
  continuity: WorkflowContinuitySignal;
  bottlenecks: WorkflowBottleneck[];
  recoveryOptions: WorkflowRecoveryOption[];
  supervision: LifecycleSupervisionRecord;
  generatedAt: string;
  meta: ExecutiveWorkflowFabricOverview["meta"];
};

export type WorkflowPauseResumeResult = {
  ok: boolean;
  workflowId: string;
  action: "pause" | "resume";
  auditId: string;
  message: string;
  workflow?: PersistentWorkflowState;
};
