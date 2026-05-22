import { buildClientOperationsGraph } from "@/lib/fulfillment/client-operations-graph";
import type {
  ClientRelationshipIntelligenceResult,
  ExecutiveKnowledgeEngineInput,
  KnowledgeEvidenceLink,
} from "@/lib/executive-agent/executive-knowledge-types";

export function buildClientRelationshipIntelligence(
  input: ExecutiveKnowledgeEngineInput,
  clientIdFilter?: string | null
): ClientRelationshipIntelligenceResult {
  const byClient = new Map<string, typeof input.snapshots>();
  for (const s of input.snapshots) {
    if (clientIdFilter && s.clientId !== clientIdFilter) continue;
    const list = byClient.get(s.clientId) ?? [];
    list.push(s);
    byClient.set(s.clientId, list);
  }

  const multiOrderClients: ClientRelationshipIntelligenceResult["multiOrderClients"] = [];
  const recurringRevisionClients: string[] = [];
  let crossDepartmentClients = 0;

  for (const [clientId, orders] of byClient) {
    const depts = [...new Set(orders.map((o) => o.department))];
    if (depts.length >= 2) crossDepartmentClients += 1;
    if (orders.length >= 2) {
      multiOrderClients.push({ clientId, orderCount: orders.length, departments: depts });
    }
    const lifecycle = input.operationalMemory.clientLifecycle.find((c) => c.clientId === clientId);
    if (lifecycle?.revisionBurden === "high") recurringRevisionClients.push(clientId);
  }

  const relationshipInsights: string[] = [];
  if (crossDepartmentClients > 0) {
    relationshipInsights.push(
      `${crossDepartmentClients} client(s) span multiple fulfillment departments — coordinate sequencing advisories only.`
    );
  }
  if (recurringRevisionClients.length > 0) {
    relationshipInsights.push(
      `${recurringRevisionClients.length} client(s) show high revision burden in lifecycle memory.`
    );
  }

  const sampleClient = [...byClient.entries()][0];
  if (sampleClient) {
    const graph = buildClientOperationsGraph({
      clientId: sampleClient[0],
      orders: sampleClient[1],
    });
    if (graph.edges.length > 0) {
      relationshipInsights.push(
        `Sample cross-order graph: ${graph.edges.length} relationship edge(s) (read-only).`
      );
    }
  }

  const evidence: KnowledgeEvidenceLink[] = [
    { source: "snapshots", detail: `${byClient.size} clients in knowledge scope` },
    { source: "operational_memory", detail: "Client lifecycle insights from operational memory" },
  ];

  return {
    clientsAnalyzed: byClient.size,
    crossDepartmentClients,
    recurringRevisionClients: recurringRevisionClients.slice(0, 15),
    multiOrderClients: multiOrderClients.slice(0, 15),
    relationshipInsights,
    confidence: byClient.size >= 5 ? "high" : byClient.size >= 2 ? "medium" : "low",
    evidence,
    advisoryOnly: true,
  };
}
