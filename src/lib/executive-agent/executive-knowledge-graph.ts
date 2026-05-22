import { buildClientRelationshipIntelligence } from "@/lib/executive-agent/client-relationship-intelligence";
import { trackDepartmentEvolution } from "@/lib/executive-agent/department-evolution-tracking";
import { buildExecutiveHistoricalContext } from "@/lib/executive-agent/executive-historical-context";
import type {
  ExecutiveKnowledgeEngineInput,
  ExecutiveKnowledgeGraphResult,
  ExecutiveKnowledgeOverviewResult,
  KnowledgeEvidenceLink,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "@/lib/executive-agent/executive-knowledge-types";
import { buildInstitutionalBottleneckMemory } from "@/lib/executive-agent/institutional-bottleneck-memory";
import { buildLifecycleIntelligence } from "@/lib/executive-agent/lifecycle-intelligence-engine";
import { buildOrganizationalPatternIntelligence } from "@/lib/executive-agent/organizational-pattern-intelligence";
import { buildStrategicMemoryStore } from "@/lib/executive-agent/strategic-memory-store";
import { buildStrategicPriorityMemory } from "@/lib/executive-agent/strategic-priority-memory";

function graphConfidence(nodeCount: number): ExecutiveKnowledgeGraphResult["confidence"] {
  if (nodeCount >= 12) return "high";
  if (nodeCount >= 5) return "medium";
  return "low";
}

export function buildExecutiveKnowledgeGraph(
  input: ExecutiveKnowledgeEngineInput,
  opts?: { clientId?: string | null }
): ExecutiveKnowledgeGraphResult {
  const nodes: KnowledgeGraphNode[] = [];
  const edges: KnowledgeGraphEdge[] = [];
  const clientFilter = opts?.clientId ?? null;

  const relationships = buildClientRelationshipIntelligence(input, clientFilter);
  const deptEvolution = trackDepartmentEvolution(input);
  const bottlenecks = buildInstitutionalBottleneckMemory(input);
  const priorities = buildStrategicPriorityMemory(input);
  const patterns = buildOrganizationalPatternIntelligence(input);

  for (const m of relationships.multiOrderClients.slice(0, 8)) {
    nodes.push({
      id: `client:${m.clientId}`,
      kind: "client",
      label: `Client ${m.clientId.slice(0, 8)}…`,
      weight: m.orderCount,
      confidence: "medium",
      evidence: [{ source: "snapshots", detail: `${m.orderCount} orders` }],
    });
    for (const dept of m.departments) {
      const deptId = `dept:${dept}`;
      if (!nodes.some((n) => n.id === deptId)) {
        nodes.push({
          id: deptId,
          kind: "department",
          label: dept,
          weight: deptEvolution.departments.find((d) => d.department === dept)?.activeOrders ?? 1,
          confidence: "medium",
          evidence: [{ source: "snapshots", detail: "Department node" }],
        });
      }
      edges.push({
        from: `client:${m.clientId}`,
        to: deptId,
        relation: "fulfillment_active",
        strength: 0.7,
        evidence: [{ source: "inference", detail: "Multi-department client relationship" }],
      });
    }
  }

  for (const b of bottlenecks.bottlenecks.slice(0, 6)) {
    const nid = `bottleneck:${b.id}`;
    nodes.push({
      id: nid,
      kind: "bottleneck",
      label: `${b.department} @ ${b.stage}`,
      weight: b.recurrenceScore,
      confidence: b.recurrenceScore >= 0.5 ? "high" : "medium",
      evidence: [{ source: "operational_memory", detail: b.institutionalWeakness }],
    });
    edges.push({
      from: nid,
      to: `dept:${b.department}`,
      relation: "constrains",
      strength: b.recurrenceScore,
      evidence: [{ source: "operational_memory", detail: "Bottleneck recurrence" }],
    });
  }

  for (const p of priorities.priorities.slice(0, 6)) {
    nodes.push({
      id: `priority:${p.id}`,
      kind: "priority",
      label: p.title.slice(0, 60),
      weight: p.confidence,
      confidence: p.confidence >= 0.8 ? "high" : "medium",
      evidence: [{ source: "memory_items", detail: p.summary.slice(0, 80) }],
    });
    if (p.subjectId) {
      edges.push({
        from: `priority:${p.id}`,
        to: p.subjectId.startsWith("client:")
          ? p.subjectId
          : `client:${p.subjectId}`,
        relation: "strategic_focus",
        strength: p.confidence,
        evidence: [{ source: "memory_items", detail: "Strategic priority link" }],
      });
    }
  }

  for (const pat of patterns.patterns.slice(0, 4)) {
    nodes.push({
      id: `pattern:${pat.id}`,
      kind: "pattern",
      label: pat.label,
      weight: pat.frequency,
      confidence: pat.confidence,
      evidence: [{ source: "audit", detail: pat.insight }],
    });
  }

  const evidence: KnowledgeEvidenceLink[] = [
    { source: "inference", detail: `Knowledge graph assembled from ${nodes.length} nodes` },
    { source: "operational_memory", detail: "Operational memory + strategic items" },
  ];

  return {
    nodes,
    edges,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    confidence: graphConfidence(nodes.length),
    evidence,
    advisoryOnly: true,
  };
}

/** Full executive knowledge overview — pure, read-only intelligence bundle. */
export function buildExecutiveKnowledgeOverview(
  input: ExecutiveKnowledgeEngineInput
): ExecutiveKnowledgeOverviewResult {
  const strategicMemory = buildStrategicMemoryStore(input);
  const clientRelationships = buildClientRelationshipIntelligence(input);
  const departmentEvolution = trackDepartmentEvolution(input);
  const institutionalBottlenecks = buildInstitutionalBottleneckMemory(input);
  const strategicPriorities = buildStrategicPriorityMemory(input);
  const lifecycle = buildLifecycleIntelligence(input);
  const organizationalPatterns = buildOrganizationalPatternIntelligence(input);
  const historicalContext = buildExecutiveHistoricalContext(input);
  const graph = buildExecutiveKnowledgeGraph(input);

  const skipperSummary = [
    "Executive knowledge graph (advisory, read-only):",
    `${graph.nodeCount} nodes / ${graph.edgeCount} edges (${graph.confidence} confidence).`,
    `${clientRelationships.crossDepartmentClients} cross-department client(s); ${lifecycle.trajectories.filter((t) => t.phase === "at_risk").length} at-risk trajectory signal(s).`,
    `${institutionalBottlenecks.bottlenecks.length} institutional bottleneck memory record(s).`,
    `${strategicPriorities.activePriorityCount} strategic priority memory item(s).`,
    organizationalPatterns.institutionalWeaknesses.length
      ? `Weaknesses: ${organizationalPatterns.institutionalWeaknesses.slice(0, 2).join("; ")}.`
      : "No major institutional weakness cluster detected.",
    "No autonomous strategic changes, restructuring, or delegation.",
  ].join(" ");

  return {
    graph,
    strategicMemory,
    clientRelationships,
    departmentEvolution,
    institutionalBottlenecks,
    strategicPriorities,
    lifecycle,
    organizationalPatterns,
    historicalContext,
    skipperSummary,
    generatedAt: new Date().toISOString(),
    meta: {
      readOnlyIntelligence: true,
      advisoryOnly: true,
      noAutonomousStrategicChanges: true,
      noProductionMutation: true,
      explainable: true,
      evidenceLinked: true,
    },
  };
}
