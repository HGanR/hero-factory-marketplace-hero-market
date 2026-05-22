import type { ExecutiveKpiEngineInput } from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { ForecastConfidence } from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { OperatorWorkloadSnapshot } from "@/lib/executive-agent/executive-operator-types";
import type { TaskCoordinationMetadata } from "@/lib/executive-agent/executive-operator-types";

export type PlanningConfidence = ForecastConfidence;

export type PlanningEvidenceLink = {
  source: "snapshots" | "kpi" | "memory" | "tasks" | "operators" | "knowledge" | "assumption";
  detail: string;
};

export type PlanningPlanId =
  | "multi_department_ops"
  | "operational_recovery"
  | "staffing_adjustment"
  | "bottleneck_mitigation"
  | "campaign_sequencing"
  | "governance_scheduling"
  | "escalation_response"
  | "workload_balance"
  | "executive_initiative";

export type PlanningPlanDefinition = {
  id: PlanningPlanId;
  label: string;
  description: string;
  departments: FulfillmentOrchestrationDepartment[] | "all";
};

export type PlanningStep = {
  order: number;
  action: string;
  owner: string;
  department: FulfillmentOrchestrationDepartment | null;
  rationale: string;
  requiresHumanApproval: boolean;
  reversible: true;
};

export type PlanningModuleResult = {
  planId: PlanningPlanId;
  title: string;
  summary: string;
  steps: PlanningStep[];
  confidence: PlanningConfidence;
  confidenceScore: number;
  evidence: PlanningEvidenceLink[];
  advisoryOnly: true;
  planningOnly: true;
  noAutonomousExecution: true;
};

export type ExecutivePlanningEngineInput = {
  kpi: ExecutiveKpiEngineInput;
  operatorWorkload: OperatorWorkloadSnapshot[];
  tasks: ExecutiveOperationalTaskDto[];
  metadataByTaskId: Map<string, TaskCoordinationMetadata>;
  strategicPriorityTitles: string[];
  openDecisionCount: number;
};

export type ExecutivePlanningRunResult = {
  planId: PlanningPlanId;
  horizonDays: number;
  multiDepartment: PlanningModuleResult;
  operationalRecovery: PlanningModuleResult;
  staffingAdjustment: PlanningModuleResult;
  bottleneckMitigation: PlanningModuleResult;
  campaignSequencing: PlanningModuleResult;
  governanceScheduling: PlanningModuleResult;
  escalationResponse: PlanningModuleResult;
  workloadBalance: PlanningModuleResult;
  executiveInitiative: PlanningModuleResult;
  confidence: PlanningConfidence;
  confidenceScore: number;
  evidence: PlanningEvidenceLink[];
  skipperSummary: string;
  generatedAt: string;
  meta: {
    planningOnly: true;
    advisoryOnly: true;
    noAutonomousExecution: true;
    noProductionMutation: true;
    explainable: true;
    evidenceLinked: true;
    reversible: true;
  };
};

export type ExecutivePlanningOverviewDto = {
  ok: true;
  plans: PlanningPlanDefinition[];
  deskPreview: {
    activeOrders: number;
    stalledOrders: number;
    pendingApprovals: number;
    openTasks: number;
    overloadedOperators: number;
  };
  generatedAt: string;
  meta: ExecutivePlanningRunResult["meta"];
};

export type ExecutivePlanningGenerateDto = {
  ok: true;
  result: ExecutivePlanningRunResult;
  generatedAt: string;
  meta: ExecutivePlanningRunResult["meta"];
};
