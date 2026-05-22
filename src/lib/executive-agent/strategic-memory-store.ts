import type {
  ExecutiveKnowledgeEngineInput,
  KnowledgeEvidenceLink,
  StrategicMemoryStoreResult,
} from "@/lib/executive-agent/executive-knowledge-types";

function confidenceFromSample(n: number): StrategicMemoryStoreResult["confidence"] {
  if (n >= 8) return "high";
  if (n >= 3) return "medium";
  return "low";
}

export function buildStrategicMemoryStore(
  input: ExecutiveKnowledgeEngineInput
): StrategicMemoryStoreResult {
  const items = input.strategicMemoryItems;
  const themes = new Set<string>();
  const longHorizonNotes: string[] = [];

  for (const item of items) {
    if (item.memoryType === "client_priority" || item.memoryType === "decision") {
      themes.add("strategic_priority");
    }
    if (item.memoryType === "recurring_issue") themes.add("recurring_operational_issue");
    if (item.memoryType === "agent_pattern") themes.add("agent_coordination_pattern");
    if (item.summary.length > 40) {
      longHorizonNotes.push(`${item.title}: ${item.summary.slice(0, 120)}`);
    }
  }

  const evidence: KnowledgeEvidenceLink[] = [
    { source: "memory_items", detail: `${items.length} persisted executive memory items` },
  ];
  if (input.operationalMemory.ordersAnalyzed > 0) {
    evidence.push({
      source: "operational_memory",
      detail: `${input.operationalMemory.ordersAnalyzed} orders in operational memory store`,
    });
  }

  return {
    items,
    themes: [...themes],
    longHorizonNotes: longHorizonNotes.slice(0, 12),
    confidence: confidenceFromSample(items.length),
    evidence,
    advisoryOnly: true,
  };
}
