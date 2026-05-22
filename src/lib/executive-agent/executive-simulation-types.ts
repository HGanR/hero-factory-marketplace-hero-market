import type { ExecutiveKpiEngineInput } from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { ForecastConfidence } from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { OperatorWorkloadSnapshot } from "@/lib/executive-agent/executive-operator-types";
import type { TaskCoordinationMetadata } from "@/lib/executive-agent/executive-operator-types";

export type SimulationConfidence = ForecastConfidence;

export type SimulationEvidenceLink = {
  source: "snapshots" | "memory" | "forecast" | "operator_workload" | "assumption";
  detail: string;
};

export type SimulationScenarioId =
  | "baseline"
  | "approval_delay_stress"
  | "operator_redistribution"
  | "escalation_pressure"
  | "department_rebalance"
  | "launch_readiness_watch"
  | "governance_stagnation_watch";

export type SimulationScenarioAssumptions = {
  horizonDays?: number;
  additionalApprovalDelayHours?: number;
  simulateOperatorRedistribution?: boolean;
  escalationLevelDelta?: number;
  departmentLoadShiftPercent?: Partial<Record<FulfillmentOrchestrationDepartment, number>>;
};

export type SimulationScenarioDefinition = {
  id: SimulationScenarioId;
  label: string;
  description: string;
  defaultAssumptions: SimulationScenarioAssumptions;
};

export type FulfillmentTimelineSimulationResult = {
  medianCompletionDays: number;
  p90CompletionDays: number;
  ordersSimulated: number;
  stalledProjected: number;
  confidence: SimulationConfidence;
  confidenceScore: number;
  evidence: SimulationEvidenceLink[];
  advisoryOnly: true;
};

export type OperatorRedistributionSimulationResult = {
  fromOperatorId: string;
  toOperatorId: string;
  tasksRedistributed: number;
  projectedLoadDelta: number;
  confidence: SimulationConfidence;
  rationale: string;
  evidence: SimulationEvidenceLink[];
  advisoryOnly: true;
};

export type ApprovalDelayImpactResult = {
  pendingApprovals: number;
  additionalHours: number;
  projectedDeskDelayDays: number;
  affectedDepartments: FulfillmentOrchestrationDepartment[];
  confidence: SimulationConfidence;
  evidence: SimulationEvidenceLink[];
  advisoryOnly: true;
};

export type CampaignLaunchProbabilityResult = {
  ordersAnalyzed: number;
  launchSuccessProbability: number;
  atRiskProbability: number;
  confidence: SimulationConfidence;
  factors: string[];
  evidence: SimulationEvidenceLink[];
  advisoryOnly: true;
};

export type GovernanceStagnationModelResult = {
  smartTrustOrders: number;
  stagnationProbability: number;
  avgDaysToResolution: number;
  confidence: SimulationConfidence;
  evidence: SimulationEvidenceLink[];
  advisoryOnly: true;
};

export type BottleneckCascadeSimulationResult = {
  initialBottlenecks: number;
  projectedCascadeDepth: number;
  affectedDepartments: FulfillmentOrchestrationDepartment[];
  revisionCascadeRisk: number;
  confidence: SimulationConfidence;
  evidence: SimulationEvidenceLink[];
  advisoryOnly: true;
};

export type DepartmentLoadSimulationResult = {
  departments: Array<{
    department: FulfillmentOrchestrationDepartment;
    currentLoadIndex: number;
    simulatedLoadIndex: number;
    delta: number;
  }>;
  imbalanceScore: number;
  confidence: SimulationConfidence;
  evidence: SimulationEvidenceLink[];
  advisoryOnly: true;
};

export type EscalationImpactSimulationResult = {
  escalationsProjected: number;
  executiveOwnerInvolvementProbability: number;
  avgLevelsClimbed: number;
  confidence: SimulationConfidence;
  evidence: SimulationEvidenceLink[];
  advisoryOnly: true;
};

export type ForecastConfidenceCalibration = {
  overallConfidence: SimulationConfidence;
  overallScore: number;
  sampleOrders: number;
  memorySamples: number;
  calibrationNotes: string[];
  evidence: SimulationEvidenceLink[];
};

export type ScenarioComparisonRow = {
  metric: string;
  baseline: string | number;
  scenario: string | number;
  delta: string;
  better: boolean | null;
};

export type ExecutiveSimulationRunResult = {
  scenarioId: SimulationScenarioId;
  scenarioLabel: string;
  assumptions: SimulationScenarioAssumptions;
  timeline: FulfillmentTimelineSimulationResult;
  operatorRedistribution: OperatorRedistributionSimulationResult[];
  approvalDelayImpact: ApprovalDelayImpactResult;
  campaignLaunchProbability: CampaignLaunchProbabilityResult;
  governanceStagnation: GovernanceStagnationModelResult;
  bottleneckCascade: BottleneckCascadeSimulationResult;
  departmentLoad: DepartmentLoadSimulationResult;
  escalationImpact: EscalationImpactSimulationResult;
  confidenceCalibration: ForecastConfidenceCalibration;
  scenarioComparison: ScenarioComparisonRow[];
  skipperSummary: string;
};

export type ExecutiveSimulationOverviewDto = {
  ok: true;
  scenarios: SimulationScenarioDefinition[];
  baselinePreview: {
    activeOrders: number;
    stalledOrders: number;
    pendingApprovals: number;
    velocityScore: number;
  };
  generatedAt: string;
  meta: {
    simulationOnly: true;
    noProductionMutation: true;
    noAutonomousExecution: true;
    advisoryOnly: true;
  };
};

export type ExecutiveSimulationRunDto = {
  ok: true;
  result: ExecutiveSimulationRunResult;
  generatedAt: string;
  meta: {
    simulationOnly: true;
    noProductionMutation: true;
    noAutonomousExecution: true;
    explainable: true;
  };
};

export type ExecutiveSimulationEngineInput = {
  kpi: ExecutiveKpiEngineInput;
  operatorWorkload: OperatorWorkloadSnapshot[];
  tasks: ExecutiveOperationalTaskDto[];
  metadataByTaskId: Map<string, TaskCoordinationMetadata>;
};
