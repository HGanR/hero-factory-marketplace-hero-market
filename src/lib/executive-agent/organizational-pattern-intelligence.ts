import type {
  ExecutiveKnowledgeEngineInput,
  KnowledgeEvidenceLink,
  OrganizationalPatternResult,
} from "@/lib/executive-agent/executive-knowledge-types";

export function buildOrganizationalPatternIntelligence(
  input: ExecutiveKnowledgeEngineInput
): OrganizationalPatternResult {
  const actionCounts = new Map<string, number>();
  for (const a of input.auditActionTypes) {
    actionCounts.set(a, (actionCounts.get(a) ?? 0) + 1);
  }

  const patterns: OrganizationalPatternResult["patterns"] = [];

  const simRuns = actionCounts.get("simulation_run") ?? 0;
  if (simRuns > 0) {
    patterns.push({
      id: "simulation_usage",
      label: "Executive simulation reviews",
      frequency: simRuns,
      insight: "Desk uses advisory simulation before major coordination — good governance signal.",
      confidence: "medium",
    });
  }

  const readTools = actionCounts.get("read_tool") ?? 0;
  if (readTools >= 5) {
    patterns.push({
      id: "read_heavy_desk",
      label: "Read-heavy executive orchestration",
      frequency: readTools,
      insight: "Recurring read-tool orchestration — institutional pattern of evidence-first review.",
      confidence: "high",
    });
  }

  const pendingDecisions = input.decisions.filter((d) => d.status === "open").length;
  if (pendingDecisions >= 3) {
    patterns.push({
      id: "decision_backlog",
      label: "Open decision backlog",
      frequency: pendingDecisions,
      insight: `${pendingDecisions} open operational decisions — human decision queue pressure.`,
      confidence: "high",
    });
  }

  const revisionOutcomes = input.operationalMemory.outcomes.filter(
    (o) => o.outcome === "revision_heavy"
  ).length;
  if (revisionOutcomes >= 2) {
    patterns.push({
      id: "revision_heavy_outcomes",
      label: "Revision-heavy fulfillment outcomes",
      frequency: revisionOutcomes,
      insight: "Recurring revision loops across departments — institutional quality/review weakness.",
      confidence: revisionOutcomes >= 4 ? "high" : "medium",
    });
  }

  const institutionalWeaknesses: string[] = [];
  if (input.operationalMemory.bottleneckRecurrence.some((b) => b.recurrenceScore >= 0.5)) {
    institutionalWeaknesses.push("Recurring stage bottlenecks across fulfillment departments");
  }
  if (input.operationalMemory.approvalLatency.some((a) => (a.medianHoursToExecute ?? 0) > 48)) {
    institutionalWeaknesses.push("Approval latency exceeds 48h median on some gates");
  }
  const blockedTasks = input.tasks.filter((t) => t.status === "blocked").length;
  if (blockedTasks >= 2) {
    institutionalWeaknesses.push(`${blockedTasks} blocked operational tasks on desk`);
  }

  const evidence: KnowledgeEvidenceLink[] = [
    { source: "audit", detail: `${input.auditActionTypes.length} audit action samples` },
    { source: "operational_memory", detail: "Outcome and bottleneck patterns" },
    { source: "decisions", detail: `${input.decisions.length} decision records` },
  ];

  return {
    patterns: patterns.slice(0, 10),
    institutionalWeaknesses,
    confidence: patterns.length >= 3 ? "high" : patterns.length >= 1 ? "medium" : "low",
    evidence,
    advisoryOnly: true,
  };
}
