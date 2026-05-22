import type { ExecutiveKpiEngineInput } from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { ForecastConfidence } from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { OperatorWorkloadSnapshot } from "@/lib/executive-agent/executive-operator-types";
import type { TaskCoordinationMetadata } from "@/lib/executive-agent/executive-operator-types";

export type CommandConfidence = ForecastConfidence;

export type CommandSeverity = "critical" | "high" | "medium" | "low" | "watch";

export type CommandEvidenceLink = {
  source: "snapshots" | "kpi" | "audit" | "tasks" | "operators" | "memory" | "inference";
  detail: string;
};

export type OperationalEventKind =
  | "approval_pending"
  | "order_stalled"
  | "task_blocked"
  | "task_overdue"
  | "operator_overload"
  | "escalation_proposed"
  | "governance_delay"
  | "campaign_at_risk"
  | "kpi_drift"
  | "audit_signal";

export type OperationalEvent = {
  id: string;
  kind: OperationalEventKind;
  department: FulfillmentOrchestrationDepartment | null;
  severity: CommandSeverity;
  summary: string;
  occurredAt: string;
  evidence: CommandEvidenceLink[];
};

export type CommandIncident = {
  id: string;
  title: string;
  severity: CommandSeverity;
  department: FulfillmentOrchestrationDepartment | null;
  category:
    | "fulfillment_stall"
    | "approval_surge"
    | "escalation_surge"
    | "operator_overload"
    | "governance_anomaly"
    | "campaign_degradation"
    | "kpi_drift"
    | "cross_department_crisis";
  confidence: CommandConfidence;
  confidenceScore: number;
  summary: string;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type ExecutiveAlert = {
  id: string;
  rank: number;
  title: string;
  severity: CommandSeverity;
  department: FulfillmentOrchestrationDepartment | null;
  routeTo: string;
  rationale: string;
  confidence: CommandConfidence;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type ExecutiveCommandEngineInput = {
  kpi: ExecutiveKpiEngineInput;
  operatorWorkload: OperatorWorkloadSnapshot[];
  tasks: ExecutiveOperationalTaskDto[];
  metadataByTaskId: Map<string, TaskCoordinationMetadata>;
  auditActionTypes: string[];
  auditToolNames: string[];
};

export type OperationalEventStreamResult = {
  events: OperationalEvent[];
  eventCount: number;
  criticalCount: number;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type IncidentIntelligenceResult = {
  incidents: CommandIncident[];
  topIncident: CommandIncident | null;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type GovernanceAnomalyResult = {
  anomalies: Array<{
    id: string;
    summary: string;
    severity: CommandSeverity;
    department: FulfillmentOrchestrationDepartment;
  }>;
  anomalyCount: number;
  confidence: CommandConfidence;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type KpiDriftMonitorResult = {
  driftSignals: Array<{ metric: string; direction: "worsening" | "stable" | "improving"; detail: string }>;
  driftScore: number;
  confidence: CommandConfidence;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type CampaignDegradationResult = {
  atRiskOrders: number;
  degradationSignals: string[];
  confidence: CommandConfidence;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type EscalationSurgeResult = {
  surgeDetected: boolean;
  proposedEscalations: number;
  overdueTasks: number;
  severity: CommandSeverity;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type CrisisCoordinationResult = {
  crisisLevel: CommandSeverity;
  affectedDepartments: FulfillmentOrchestrationDepartment[];
  coordinationSteps: string[];
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type CommandRoutingResult = {
  routes: Array<{ department: FulfillmentOrchestrationDepartment | null; operatorId: string; reason: string }>;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type AlertPrioritizationResult = {
  alerts: ExecutiveAlert[];
  alertCount: number;
  evidence: CommandEvidenceLink[];
  advisoryOnly: true;
};

export type ExecutiveCommandOverviewResult = {
  eventStream: OperationalEventStreamResult;
  incidents: IncidentIntelligenceResult;
  governanceAnomalies: GovernanceAnomalyResult;
  kpiDrift: KpiDriftMonitorResult;
  campaignDegradation: CampaignDegradationResult;
  escalationSurge: EscalationSurgeResult;
  crisisCoordination: CrisisCoordinationResult;
  commandRouting: CommandRoutingResult;
  alertPrioritization: AlertPrioritizationResult;
  deskSnapshot: {
    activeOrders: number;
    stalledOrders: number;
    pendingApprovals: number;
    criticalAlerts: number;
  };
  confidence: CommandConfidence;
  confidenceScore: number;
  skipperSummary: string;
  generatedAt: string;
  meta: {
    monitoringOnly: true;
    advisoryOnly: true;
    noAutonomousExecution: true;
    noProductionMutation: true;
    explainable: true;
    evidenceLinked: true;
    severityRanked: true;
  };
};

export type ExecutiveCommandOverviewDto = ExecutiveCommandOverviewResult & { ok: true };

export type ExecutiveCommandIncidentsDto = {
  ok: true;
  incidents: CommandIncident[];
  topIncident: CommandIncident | null;
  generatedAt: string;
  meta: ExecutiveCommandOverviewResult["meta"];
};

export type ExecutiveCommandAlertsDto = {
  ok: true;
  alerts: ExecutiveAlert[];
  generatedAt: string;
  meta: ExecutiveCommandOverviewResult["meta"];
};
