import type { ForecastConfidence } from "@/lib/fulfillment/executive-kpi-forecast-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { OperationalMemoryStoreSnapshot } from "@/lib/fulfillment/fulfillment-operational-memory-types";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import type { ExecutiveOperatorId } from "@/lib/executive-agent/executive-operator-types";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { TaskCoordinationMetadata } from "@/lib/executive-agent/executive-operator-types";

export type KnowledgeConfidence = ForecastConfidence;

export type KnowledgeEvidenceLink = {
  source:
    | "snapshots"
    | "memory_items"
    | "audit"
    | "decisions"
    | "tasks"
    | "operational_memory"
    | "inference";
  detail: string;
};

export type StrategicMemoryItemRecord = {
  id: string;
  memoryType: string;
  title: string;
  summary: string;
  subjectType: string | null;
  subjectId: string | null;
  confidence: number;
  createdAt: string;
};

export type ExecutiveKnowledgeEngineInput = {
  snapshots: ClientFulfillmentOrderSnapshot[];
  operationalMemory: OperationalMemoryStoreSnapshot;
  strategicMemoryItems: StrategicMemoryItemRecord[];
  auditActionTypes: string[];
  auditToolNames: string[];
  decisions: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    clientId: string | null;
    orderId: string | null;
    department: string | null;
    createdAt: string;
    decidedAt: string | null;
  }>;
  tasks: ExecutiveOperationalTaskDto[];
  metadataByTaskId: Map<string, TaskCoordinationMetadata>;
};

export type KnowledgeGraphNode = {
  id: string;
  kind:
    | "client"
    | "department"
    | "operator"
    | "bottleneck"
    | "priority"
    | "pattern"
    | "decision";
  label: string;
  weight: number;
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
};

export type KnowledgeGraphEdge = {
  from: string;
  to: string;
  relation: string;
  strength: number;
  evidence: KnowledgeEvidenceLink[];
};

export type ExecutiveKnowledgeGraphResult = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  nodeCount: number;
  edgeCount: number;
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type StrategicMemoryStoreResult = {
  items: StrategicMemoryItemRecord[];
  themes: string[];
  longHorizonNotes: string[];
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type ClientRelationshipIntelligenceResult = {
  clientsAnalyzed: number;
  crossDepartmentClients: number;
  recurringRevisionClients: string[];
  multiOrderClients: Array<{ clientId: string; orderCount: number; departments: FulfillmentOrchestrationDepartment[] }>;
  relationshipInsights: string[];
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type DepartmentEvolutionRecord = {
  department: FulfillmentOrchestrationDepartment;
  activeOrders: number;
  avgDaysInStage: number;
  dominantStage: string;
  trend: "expanding" | "stable" | "contracting";
  evidence: KnowledgeEvidenceLink[];
};

export type DepartmentEvolutionTrackingResult = {
  departments: DepartmentEvolutionRecord[];
  crossDepartmentLinks: number;
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type OperatorSpecializationHistoryResult = {
  operatorId: ExecutiveOperatorId;
  label: string;
  specializations: string[];
  taskHistory: Array<{ taskType: string; count: number }>;
  delegationCount: number;
  escalationCount: number;
  evolutionInsight: string;
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type InstitutionalBottleneckMemoryResult = {
  bottlenecks: Array<{
    id: string;
    department: FulfillmentOrchestrationDepartment;
    stage: string;
    recurrenceScore: number;
    institutionalWeakness: string;
  }>;
  recurringGovernanceBlocks: number;
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type StrategicPriorityMemoryResult = {
  priorities: Array<{
    id: string;
    title: string;
    summary: string;
    subjectId: string | null;
    confidence: number;
    ageDays: number;
  }>;
  activePriorityCount: number;
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type LifecycleIntelligenceResult = {
  trajectories: Array<{
    clientId: string;
    phase: "onboarding" | "fulfillment" | "expansion" | "at_risk" | "mature";
    guidanceScore: number;
    revisionBurden: string;
    horizonInsight: string;
  }>;
  longHorizonSummary: string;
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type OrganizationalPatternResult = {
  patterns: Array<{
    id: string;
    label: string;
    frequency: number;
    insight: string;
    confidence: KnowledgeConfidence;
  }>;
  institutionalWeaknesses: string[];
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type ExecutiveHistoricalContextResult = {
  decisionOutcomes: Array<{
    decisionId: string;
    title: string;
    status: string;
    linkedOrderId: string | null;
    ageDays: number;
  }>;
  recentExecutiveActions: string[];
  historicalSummary: string;
  confidence: KnowledgeConfidence;
  evidence: KnowledgeEvidenceLink[];
  advisoryOnly: true;
};

export type ExecutiveKnowledgeOverviewResult = {
  graph: ExecutiveKnowledgeGraphResult;
  strategicMemory: StrategicMemoryStoreResult;
  clientRelationships: ClientRelationshipIntelligenceResult;
  departmentEvolution: DepartmentEvolutionTrackingResult;
  institutionalBottlenecks: InstitutionalBottleneckMemoryResult;
  strategicPriorities: StrategicPriorityMemoryResult;
  lifecycle: LifecycleIntelligenceResult;
  organizationalPatterns: OrganizationalPatternResult;
  historicalContext: ExecutiveHistoricalContextResult;
  skipperSummary: string;
  generatedAt: string;
  meta: {
    readOnlyIntelligence: true;
    advisoryOnly: true;
    noAutonomousStrategicChanges: true;
    noProductionMutation: true;
    explainable: true;
    evidenceLinked: true;
  };
};

export type ExecutiveKnowledgeOverviewDto = ExecutiveKnowledgeOverviewResult & { ok: true };

export type ExecutiveKnowledgeClientDto = {
  ok: true;
  clientId: string;
  graph: ExecutiveKnowledgeGraphResult;
  lifecycle: LifecycleIntelligenceResult;
  relationships: ClientRelationshipIntelligenceResult;
  strategicPriorities: StrategicPriorityMemoryResult;
  historicalContext: ExecutiveHistoricalContextResult;
  skipperSummary: string;
  generatedAt: string;
  meta: ExecutiveKnowledgeOverviewResult["meta"];
};

export type ExecutiveKnowledgeOperatorDto = {
  ok: true;
  operatorId: ExecutiveOperatorId;
  specializationHistory: OperatorSpecializationHistoryResult;
  workloadInsight: string;
  institutionalBottlenecks: InstitutionalBottleneckMemoryResult;
  organizationalPatterns: OrganizationalPatternResult;
  skipperSummary: string;
  generatedAt: string;
  meta: ExecutiveKnowledgeOverviewResult["meta"];
};
