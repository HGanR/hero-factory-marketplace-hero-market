import type {
  ExecutiveKnowledgeEngineInput,
  KnowledgeEvidenceLink,
  StrategicPriorityMemoryResult,
} from "@/lib/executive-agent/executive-knowledge-types";

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000))) : 0;
}

export function buildStrategicPriorityMemory(
  input: ExecutiveKnowledgeEngineInput
): StrategicPriorityMemoryResult {
  const priorityTypes = new Set(["client_priority", "decision", "preference"]);
  const raw = input.strategicMemoryItems.filter((m) => priorityTypes.has(m.memoryType));

  const priorities = raw
    .map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary.slice(0, 240),
      subjectId: m.subjectId,
      confidence: m.confidence,
      ageDays: daysSince(m.createdAt),
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20);

  const evidence: KnowledgeEvidenceLink[] = [
    { source: "memory_items", detail: `${priorities.length} strategic priority memory rows` },
  ];

  return {
    priorities,
    activePriorityCount: priorities.length,
    confidence: priorities.length >= 5 ? "high" : priorities.length >= 2 ? "medium" : "low",
    evidence,
    advisoryOnly: true,
  };
}
