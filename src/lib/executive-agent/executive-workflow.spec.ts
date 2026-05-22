import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildExecutiveWorkflowFabricOverview } from "@/lib/executive-agent/executive-workflow-fabric";
import { buildPersistentWorkflowStates } from "@/lib/executive-agent/persistent-workflow-state";
import { buildWorkflowDependencyGraph } from "@/lib/executive-agent/workflow-dependency-graph";
import { buildCrossDepartmentWorkflowChains } from "@/lib/executive-agent/cross-department-workflow-chaining";
import { buildApprovalChainOrchestration, isApprovalChainBlocking } from "@/lib/executive-agent/approval-chain-orchestration";
import { allowedLifecycleTransitions } from "@/lib/executive-agent/lifecycle-orchestration-engine";
import { detectWorkflowBottlenecks } from "@/lib/executive-agent/workflow-bottleneck-intelligence";
import { buildWorkflowRecoveryOptions } from "@/lib/executive-agent/workflow-recovery-engine";
import { monitorWorkflowContinuity } from "@/lib/executive-agent/workflow-continuity-monitor";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";

const clientId = "22222222-2222-4222-8222-222222222222";

function task(partial: Partial<ExecutiveOperationalTaskDto> & { id: string; title: string }): ExecutiveOperationalTaskDto {
  return {
    description: null,
    status: "open",
    priority: "normal",
    ownerLabel: "executive_owner",
    department: "REVENUE_OS",
    recommendedAgent: "bentley",
    decisionId: null,
    threadId: null,
    approvalId: null,
    orderId: null,
    clientId,
    subjectId: "revenue_os",
    blockedReason: null,
    dependsOnTaskIds: [],
    dueAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("executive workflow fabric", () => {
  it("builds persistent workflow state grouped by client/department", () => {
    const states = buildPersistentWorkflowStates({
      tasks: [
        task({ id: "t1", title: "Campaign review", department: "REVENUE_OS" }),
        task({ id: "t2", title: "Site draft", department: "WEBSITE", clientId }),
      ],
      threads: [],
      approvals: [],
      pausedWorkflowIds: new Set(),
      pauseMetaByWorkflowId: new Map(),
    });
    assert.ok(states.length >= 2);
  });

  it("builds workflow dependency graph with task nodes", () => {
    const states = buildPersistentWorkflowStates({
      tasks: [task({ id: "t1", title: "A", dependsOnTaskIds: [] })],
      threads: [],
      approvals: [],
      pausedWorkflowIds: new Set(),
      pauseMetaByWorkflowId: new Map(),
    });
    const wf = states[0]!;
    const graph = buildWorkflowDependencyGraph({
      workflow: wf,
      tasks: [task({ id: "t1", title: "A" })],
    });
    assert.ok(graph.nodes.some((n) => n.kind === "task"));
  });

  it("orchestrates approval chain without bypass", () => {
    const states = buildPersistentWorkflowStates({
      tasks: [task({ id: "t1", title: "Needs approval", approvalId: "a1" })],
      threads: [],
      approvals: [{ id: "a1", proposedAction: "createTodo", status: "pending", targetId: clientId }],
      pausedWorkflowIds: new Set(),
      pauseMetaByWorkflowId: new Map(),
    });
    const wf = states.find((s) => s.approvalIds.includes("a1"))!;
    const chain = buildApprovalChainOrchestration({
      workflow: wf,
      approvals: [{ id: "a1", proposedAction: "createTodo", status: "pending", targetId: clientId }],
    });
    assert.equal(chain.bypassBlocked, true);
    assert.ok(isApprovalChainBlocking(wf, chain));
  });

  it("allows governed lifecycle transitions", () => {
    const next = allowedLifecycleTransitions("coordination");
    assert.ok(next.includes("approval_pending"));
    assert.ok(next.includes("paused"));
  });

  it("detects bottlenecks and recovery options for paused workflow", () => {
    const states = buildPersistentWorkflowStates({
      tasks: [task({ id: "t1", title: "Paused flow" })],
      threads: [],
      approvals: [],
      pausedWorkflowIds: new Set([`wf:client:${clientId}:REVENUE_OS`]),
      pauseMetaByWorkflowId: new Map([
        [`wf:client:${clientId}:REVENUE_OS`, { pausedAt: new Date().toISOString(), rationale: "desk hold" }],
      ]),
    });
    const wf = states.find((s) => s.paused)!;
    assert.ok(wf);
    const bottlenecks = detectWorkflowBottlenecks(states);
    assert.ok(bottlenecks.some((b) => b.severity === "critical"));
    const graph = buildWorkflowDependencyGraph({ workflow: wf, tasks: [task({ id: "t1", title: "Paused flow" })] });
    const continuity = monitorWorkflowContinuity({ workflow: wf, dependencyGraph: graph });
    const recovery = buildWorkflowRecoveryOptions({ workflow: wf, continuity });
    assert.ok(recovery.some((r) => r.kind === "resume_stage"));
  });

  it("assembles fabric overview with governed meta", () => {
    const overview = buildExecutiveWorkflowFabricOverview({
      tasks: [
        task({ id: "t1", title: "Rev", department: "REVENUE_OS" }),
        task({ id: "t2", title: "Web", department: "WEBSITE" }),
      ],
      threads: [],
      approvals: [],
      pausedWorkflowIds: new Set(),
      pauseMetaByWorkflowId: new Map(),
    });
    assert.equal(overview.meta.noWorkflowApprovalBypass, true);
    assert.equal(overview.meta.noUnrestrictedAutonomousExecution, true);
    assert.ok(overview.skipperSummary.includes("Workflow fabric"));
    const links = buildCrossDepartmentWorkflowChains(overview.workflows);
    assert.ok(Array.isArray(links));
  });
});
