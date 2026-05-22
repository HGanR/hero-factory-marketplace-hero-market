import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExecutiveKnowledgeGraph, buildExecutiveKnowledgeOverview } from "@/lib/executive-agent/executive-knowledge-graph";
import { buildStrategicMemoryStore } from "@/lib/executive-agent/strategic-memory-store";
import { buildStrategicPriorityMemory } from "@/lib/executive-agent/strategic-priority-memory";
import { buildInstitutionalBottleneckMemory } from "@/lib/executive-agent/institutional-bottleneck-memory";
import { buildClientRelationshipIntelligence } from "@/lib/executive-agent/client-relationship-intelligence";
import { trackDepartmentEvolution } from "@/lib/executive-agent/department-evolution-tracking";
import { buildOperatorSpecializationHistory } from "@/lib/executive-agent/operator-specialization-history";
import { buildLifecycleIntelligence } from "@/lib/executive-agent/lifecycle-intelligence-engine";
import { buildOrganizationalPatternIntelligence } from "@/lib/executive-agent/organizational-pattern-intelligence";
import { buildExecutiveHistoricalContext } from "@/lib/executive-agent/executive-historical-context";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import type { ExecutiveKnowledgeEngineInput } from "@/lib/executive-agent/executive-knowledge-types";
import { buildOperationalMemoryStore } from "@/lib/fulfillment/operational-memory-store";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";

function snap(partial: Partial<ClientFulfillmentOrderSnapshot> & { orderId: string }): ClientFulfillmentOrderSnapshot {
  return {
    clientId: "c1",
    department: "WEBSITE",
    assignedDepartment: "site_builder",
    pipelineStage: "service_drafting",
    approvalStatus: "none",
    ownerReviewStatus: null,
    paymentStatus: "confirmed",
    paymentConsumed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    daysInCurrentStage: 5,
    ...partial,
  };
}

const baseInput: ExecutiveKnowledgeEngineInput = {
  snapshots: [
    snap({ orderId: "o1", clientId: "c1" }),
    snap({ orderId: "o2", clientId: "c1", department: "TRUST", daysInCurrentStage: 12 }),
    snap({ orderId: "o3", clientId: "c2", department: "SMART_TRUST", approvalStatus: "pending", daysInCurrentStage: 11 }),
  ],
  operationalMemory: buildOperationalMemoryStore({
    orders: [
      {
        orderId: "o1",
        clientId: "c1",
        department: "WEBSITE",
        pipelineStage: "service_drafting",
        approvalStatus: "none",
        ownerReviewStatus: "pending",
        clientDeliveryStatus: "not_sent",
        draftVersion: 1,
        daysInCurrentStage: 5,
        paymentConsumed: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        orderId: "o2",
        clientId: "c1",
        department: "TRUST",
        pipelineStage: "owner_review",
        approvalStatus: "none",
        ownerReviewStatus: "pending",
        clientDeliveryStatus: "not_sent",
        draftVersion: 2,
        daysInCurrentStage: 12,
        paymentConsumed: true,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
    approvals: [],
    revisionEventCounts: new Map([["o1", 2]]),
    auditActions: [
      { actionType: "read_tool", toolName: "getExecutiveKnowledgeOverview" },
      { actionType: "simulation_run", toolName: "runExecutiveSimulation" },
    ],
    memoryItemTitles: ["Q2 client priority"],
  }),
  strategicMemoryItems: [
    {
      id: "m1",
      memoryType: "client_priority",
      title: "Priority client c1",
      summary: "Long-horizon strategic focus on c1 cross-department fulfillment",
      subjectType: "client",
      subjectId: "c1",
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    },
  ],
  auditActionTypes: ["read_tool", "simulation_run", "decision_recorded"],
  auditToolNames: ["getExecutiveKnowledgeOverview"],
  decisions: [
    {
      id: "d1",
      title: "Approve trust sequencing",
      status: "decided",
      priority: "high",
      clientId: "c1",
      orderId: "o2",
      department: "TRUST",
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      decidedAt: new Date().toISOString(),
    },
  ],
  tasks: [],
  metadataByTaskId: new Map(),
};

describe("executive knowledge graph", () => {
  it("builds knowledge graph with nodes and edges", () => {
    const graph = buildExecutiveKnowledgeGraph(baseInput);
    assert.ok(graph.nodeCount >= 2);
    assert.equal(graph.advisoryOnly, true);
    assert.ok(graph.evidence.length > 0);
  });

  it("builds strategic memory store", () => {
    const mem = buildStrategicMemoryStore(baseInput);
    assert.ok(mem.themes.includes("strategic_priority"));
    assert.equal(mem.advisoryOnly, true);
  });

  it("tracks strategic priorities", () => {
    const pri = buildStrategicPriorityMemory(baseInput);
    assert.equal(pri.activePriorityCount, 1);
  });

  it("models institutional bottlenecks", () => {
    const b = buildInstitutionalBottleneckMemory(baseInput);
    assert.equal(b.advisoryOnly, true);
  });

  it("analyzes cross-client relationships", () => {
    const rel = buildClientRelationshipIntelligence(baseInput);
    assert.equal(rel.crossDepartmentClients, 1);
    assert.ok(rel.multiOrderClients.some((m) => m.clientId === "c1"));
  });

  it("tracks department evolution", () => {
    const ev = trackDepartmentEvolution(baseInput);
    assert.equal(ev.departments.length, 4);
  });

  it("builds operator specialization history", () => {
    const op = buildOperatorSpecializationHistory(baseInput, "website_desk_lead");
    assert.equal(op.operatorId, "website_desk_lead");
    assert.ok(op.specializations.length > 0);
  });

  it("models lifecycle intelligence", () => {
    const life = buildLifecycleIntelligence(baseInput);
    assert.ok(life.trajectories.length >= 1);
    assert.ok(life.longHorizonSummary.includes("trajectory"));
  });

  it("detects organizational patterns", () => {
    const org = buildOrganizationalPatternIntelligence(baseInput);
    assert.ok(org.patterns.length >= 1);
  });

  it("builds historical context", () => {
    const hist = buildExecutiveHistoricalContext(baseInput);
    assert.equal(hist.decisionOutcomes.length, 1);
    assert.ok(hist.historicalSummary.includes("decided"));
  });

  it("assembles full knowledge overview", () => {
    const overview = buildExecutiveKnowledgeOverview(baseInput);
    assert.ok(overview.skipperSummary.includes("advisory"));
    assert.equal(overview.meta.readOnlyIntelligence, true);
    assert.equal(overview.meta.noAutonomousStrategicChanges, true);
  });
});

describe("Skipper read tools", () => {
  it("picker selects knowledge tools", () => {
    const tools = pickExecutiveReadTools(
      "Show the executive knowledge graph and long-horizon strategic memory",
      null,
      null
    );
    assert.ok(tools.includes("getExecutiveKnowledgeOverview"));
    assert.ok(tools.includes("getExecutiveKnowledgeClient"));
  });
});
