import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAgentCapabilityRegistry, isExecutiveDeskAgentId } from "@/lib/executive-agent/agent-capability-registry";
import { buildAgentApprovalRoute, validateAgentApprovalRouting } from "@/lib/executive-agent/agent-approval-routing";
import { buildAgentTaskRouteRecommendation } from "@/lib/executive-agent/agent-task-routing";
import { scoreAgentSpecializationForTask } from "@/lib/executive-agent/agent-specialization-intelligence";
import { buildAgentWorkloadBalances } from "@/lib/executive-agent/agent-workload-balancing";
import { buildCrossAgentEscalationPaths } from "@/lib/executive-agent/cross-agent-escalation";
import { buildExecutiveAgentCoordinationOverview } from "@/lib/executive-agent/executive-agent-coordination-engine";
import { buildExecutiveAgentHierarchy, canAgentEscalateTo } from "@/lib/executive-agent/executive-agent-hierarchy";
import { buildInterAgentThreadLinks } from "@/lib/executive-agent/inter-agent-threading";
import { buildPersistentAgentWorkspaces } from "@/lib/executive-agent/persistent-agent-workspaces";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type { ExecutiveOperationalThreadDto } from "@/lib/executive-agent/executive-conversation-threads";

const task = (partial: Partial<ExecutiveOperationalTaskDto> & { id: string; title: string }): ExecutiveOperationalTaskDto => ({
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
  clientId: null,
  subjectId: "revenue_os",
  blockedReason: null,
  dependsOnTaskIds: [],
  dueAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...partial,
});

const thread = (partial: Partial<ExecutiveOperationalThreadDto> & { id: string; title: string }): ExecutiveOperationalThreadDto => ({
  threadKind: "department",
  status: "open",
  priority: "normal",
  subjectId: "trust_jarva",
  department: "TRUST",
  clientId: "22222222-2222-4222-8222-222222222222",
  orderId: null,
  approvalId: null,
  decisionNeeded: true,
  pinnedNoteText: null,
  memorySummary: null,
  unresolvedQuestionCount: 1,
  lastMessageAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...partial,
});

describe("executive agent coordination", () => {
  it("registers all five desk agents with no autonomous execution", () => {
    const registry = buildAgentCapabilityRegistry();
    assert.equal(registry.length, 5);
    assert.ok(registry.every((a) => a.canAutonomouslyExecute === false));
    assert.ok(registry.every((c) => c.capabilities.every((cap) => cap.requiresApproval)));
  });

  it("builds hierarchy with Skipper as nexus", () => {
    const hierarchy = buildExecutiveAgentHierarchy();
    const skipper = hierarchy.find((n) => n.agentId === "skipper");
    assert.equal(skipper?.tier, 0);
    assert.equal(skipper?.approvalAuthority, "nexus");
    assert.ok(canAgentEscalateTo("bentley", "skipper"));
    assert.equal(canAgentEscalateTo("skipper", "bentley"), false);
  });

  it("builds persistent workspaces per agent", () => {
    const workspaces = buildPersistentAgentWorkspaces({
      tasks: [task({ id: "t1", title: "Campaign review", department: "REVENUE_OS" })],
      threads: [thread({ id: "th1", title: "Trust packet review" })],
      pendingApprovalCount: 2,
    });
    assert.equal(workspaces.length, 5);
    const bentley = workspaces.find((w) => w.agentId === "bentley");
    assert.ok(bentley && bentley.activeTasks >= 1);
  });

  it("links inter-agent threads with hierarchy evidence", () => {
    const links = buildInterAgentThreadLinks([thread({ id: "th1", title: "Governance delay" })]);
    assert.ok(links.length >= 1);
    assert.ok(links[0]!.targetAgentIds.includes("skipper"));
  });

  it("scores specialization and routes with approval requirement", () => {
    const t = task({ id: "t2", title: "Campaign launch readiness", department: "REVENUE_OS" });
    const scores = scoreAgentSpecializationForTask(t);
    assert.equal(scores[0]!.agentId, "bentley");
    const route = buildAgentTaskRouteRecommendation(t);
    assert.equal(route.requiresApproval, true);
    assert.equal(route.recommendedAgentId, "bentley");
    const approval = buildAgentApprovalRoute(route);
    assert.equal(approval.approvalRequired, true);
    assert.ok(approval.policyChecks.includes("no_autonomous_execution"));
  });

  it("blocks routing to advisory-only Skipper with human confirmation", () => {
    const denied = validateAgentApprovalRouting({ targetAgentId: "skipper", humanConfirmed: true });
    assert.equal(denied.allowed, false);
  });

  it("builds cross-agent escalation paths for overloaded workspaces", () => {
    const workspaces = buildPersistentAgentWorkspaces({
      tasks: [
        task({ id: "t3", title: "A", department: "REVENUE_OS", status: "open" }),
        task({ id: "t4", title: "B", department: "REVENUE_OS", status: "open" }),
        task({ id: "t5", title: "C", department: "REVENUE_OS", status: "open" }),
        task({ id: "t6", title: "D", department: "REVENUE_OS", status: "open" }),
        task({ id: "t7", title: "E", department: "REVENUE_OS", status: "open" }),
      ],
      threads: [],
      pendingApprovalCount: 0,
    });
    const balances = buildAgentWorkloadBalances({ workspaces, operatorWorkload: [] });
    const paths = buildCrossAgentEscalationPaths({ workspaces, workloadBalances: balances });
    assert.ok(paths.some((p) => p.toAgentId === "skipper"));
    assert.ok(paths.every((p) => p.requiresApproval));
  });

  it("assembles full coordination overview with governed meta", () => {
    const overview = buildExecutiveAgentCoordinationOverview({
      tasks: [task({ id: "t8", title: "Client follow-up", department: "WEBSITE", recommendedAgent: "reality" })],
      threads: [],
      operatorWorkload: [],
      pendingApprovalCount: 1,
    });
    assert.equal(overview.meta.noUnrestrictedAutonomousExecution, true);
    assert.equal(overview.meta.departmentIsolationPreserved, true);
    assert.ok(overview.skipperSummary.includes("Multi-agent coordination"));
    assert.ok(isExecutiveDeskAgentId("jarva"));
  });
});
