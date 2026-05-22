import type {
  ExecutiveKnowledgeEngineInput,
  KnowledgeEvidenceLink,
  LifecycleIntelligenceResult,
} from "@/lib/executive-agent/executive-knowledge-types";

export function buildLifecycleIntelligence(
  input: ExecutiveKnowledgeEngineInput,
  clientIdFilter?: string | null
): LifecycleIntelligenceResult {
  const lifecycle = clientIdFilter
    ? input.operationalMemory.clientLifecycle.filter((c) => c.clientId === clientIdFilter)
    : input.operationalMemory.clientLifecycle;

  const trajectories = lifecycle.map((c) => {
    const orders = input.snapshots.filter((s) => s.clientId === c.clientId);
    const hasRevenue = orders.some((o) => o.department === "REVENUE_OS");
    const stalled = orders.some((o) => o.daysInCurrentStage >= 12);
    const released = orders.every(
      (o) => o.pipelineStage === "released" || o.pipelineStage === "closed"
    );

    let phase: LifecycleIntelligenceResult["trajectories"][0]["phase"] = "fulfillment";
    if (released && orders.length > 0) phase = "mature";
    else if (stalled || c.revisionBurden === "high") phase = "at_risk";
    else if (hasRevenue && c.departmentsActive.length >= 2) phase = "expansion";
    else if (orders.length <= 1 && c.guidanceScore < 50) phase = "onboarding";

    return {
      clientId: c.clientId,
      phase,
      guidanceScore: c.guidanceScore,
      revisionBurden: c.revisionBurden,
      horizonInsight: c.insight,
    };
  });

  const atRisk = trajectories.filter((t) => t.phase === "at_risk").length;
  const longHorizonSummary =
    trajectories.length === 0
      ? "Insufficient lifecycle samples for long-horizon trajectory modeling."
      : `${trajectories.length} client trajectory(ies) modeled; ${atRisk} at-risk signal(s). Advisory only — no autonomous client status changes.`;

  const evidence: KnowledgeEvidenceLink[] = [
    { source: "operational_memory", detail: `${lifecycle.length} client lifecycle insights` },
    { source: "snapshots", detail: "Order snapshots inform phase classification" },
  ];

  return {
    trajectories: trajectories.slice(0, 25),
    longHorizonSummary,
    confidence: trajectories.length >= 5 ? "high" : trajectories.length >= 2 ? "medium" : "low",
    evidence,
    advisoryOnly: true,
  };
}
