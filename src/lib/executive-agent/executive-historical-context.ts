import type {
  ExecutiveHistoricalContextResult,
  ExecutiveKnowledgeEngineInput,
  KnowledgeEvidenceLink,
} from "@/lib/executive-agent/executive-knowledge-types";

function daysSince(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000))) : 0;
}

export function buildExecutiveHistoricalContext(
  input: ExecutiveKnowledgeEngineInput,
  filters?: { clientId?: string | null; orderId?: string | null }
): ExecutiveHistoricalContextResult {
  let decisions = input.decisions;
  if (filters?.clientId) {
    decisions = decisions.filter((d) => d.clientId === filters.clientId);
  }
  if (filters?.orderId) {
    decisions = decisions.filter((d) => d.orderId === filters.orderId);
  }

  const decisionOutcomes = decisions.slice(0, 20).map((d) => ({
    decisionId: d.id,
    title: d.title,
    status: d.status,
    linkedOrderId: d.orderId,
    ageDays: daysSince(d.decidedAt ?? d.createdAt),
  }));

  const recentExecutiveActions = [
    ...new Set(
      input.auditActionTypes
        .filter((a) => /decision|approval|simulation|kpi|memory|delegat|escalat/i.test(a))
        .slice(0, 12)
    ),
  ];

  const decided = decisions.filter((d) => d.status === "decided").length;
  const open = decisions.filter((d) => d.status === "open").length;
  const historicalSummary =
    decisions.length === 0
      ? "No operational decision ledger entries in window — historical context limited to audit and memory."
      : `Historical desk context: ${decided} decided, ${open} open decision(s); ${recentExecutiveActions.length} distinct executive action types in audit trail. Traceable and advisory only.`;

  const evidence: KnowledgeEvidenceLink[] = [
    { source: "decisions", detail: `${decisions.length} operational decisions` },
    { source: "audit", detail: `${input.auditActionTypes.length} audit events sampled` },
  ];

  return {
    decisionOutcomes,
    recentExecutiveActions,
    historicalSummary,
    confidence: decisions.length >= 5 ? "high" : decisions.length >= 1 ? "medium" : "low",
    evidence,
    advisoryOnly: true,
  };
}
