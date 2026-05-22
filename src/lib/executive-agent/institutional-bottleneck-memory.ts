import type {
  ExecutiveKnowledgeEngineInput,
  InstitutionalBottleneckMemoryResult,
  KnowledgeEvidenceLink,
} from "@/lib/executive-agent/executive-knowledge-types";

export function buildInstitutionalBottleneckMemory(
  input: ExecutiveKnowledgeEngineInput
): InstitutionalBottleneckMemoryResult {
  const bottlenecks = input.operationalMemory.bottleneckRecurrence.map((b) => ({
    id: b.id,
    department: b.department,
    stage: b.stage,
    recurrenceScore: b.recurrenceScore,
    institutionalWeakness:
      b.recurrenceScore >= 0.6
        ? `Recurring ${b.department} stall at ${b.stage} — institutional desk weakness`
        : `Emerging ${b.department} friction at ${b.stage}`,
  }));

  const recurringGovernanceBlocks = input.snapshots.filter(
    (s) =>
      s.department === "SMART_TRUST" &&
      (s.approvalStatus === "pending" || s.daysInCurrentStage >= 10)
  ).length;

  const evidence: KnowledgeEvidenceLink[] = [
    {
      source: "operational_memory",
      detail: `${bottlenecks.length} bottleneck recurrence records`,
    },
    {
      source: "snapshots",
      detail: `${recurringGovernanceBlocks} SMART_TRUST orders with governance delay signals`,
    },
  ];

  return {
    bottlenecks: bottlenecks.slice(0, 12),
    recurringGovernanceBlocks,
    confidence: bottlenecks.length >= 3 ? "high" : bottlenecks.length >= 1 ? "medium" : "low",
    evidence,
    advisoryOnly: true,
  };
}
