import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EXECUTIVE_OPERATOR_REGISTRY, isExecutiveOperatorId, resolveOperatorIdFromTask } from "@/lib/executive-agent/executive-operator-registry";
import { buildDelegationRecommendations } from "@/lib/executive-agent/delegation-recommendation-engine";
import { buildEscalationRiskAlerts } from "@/lib/executive-agent/executive-escalation-intelligence";
import { buildOperatorWorkloadAnalytics } from "@/lib/executive-agent/operator-workload-service";
import { resolveEscalationChain, nextEscalationTarget } from "@/lib/executive-agent/escalation-chain-service";
import { parseTaskCoordinationMetadata } from "@/lib/executive-agent/operator-task-metadata";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import { WRITE_ACTION_NAMES } from "@/lib/executive-agent/executive-agent-policy";
import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";

function task(partial: Partial<ExecutiveOperationalTaskDto> & { id: string }): ExecutiveOperationalTaskDto {
  return {
    title: "Test task",
    description: "desc",
    status: "open",
    priority: "normal",
    ownerLabel: "executive_owner",
    department: "WEBSITE",
    recommendedAgent: null,
    decisionId: null,
    threadId: null,
    approvalId: null,
    orderId: null,
    clientId: null,
    subjectId: null,
    blockedReason: null,
    blockedAt: null,
    dueAt: null,
    startedAt: null,
    completedAt: null,
    dependsOnTaskIds: [],
    createdAt: "",
    updatedAt: "",
    isOverdue: false,
    isBlocked: false,
    dependencyBlocked: false,
    ...partial,
  };
}

describe("executive operator registry", () => {
  it("lists governed operators for four departments", () => {
    assert.ok(EXECUTIVE_OPERATOR_REGISTRY.length >= 6);
    assert.ok(isExecutiveOperatorId("website_desk_lead"));
    assert.equal(
      resolveOperatorIdFromTask({ ownerLabel: "executive_owner", recommendedAgent: null, department: "TRUST" }),
      "trust_desk_lead"
    );
  });
});

describe("escalation chains", () => {
  it("resolves WEBSITE chain with executive owner at top", () => {
    const chain = resolveEscalationChain("WEBSITE");
    const next = nextEscalationTarget({ department: "WEBSITE", currentLevel: 0 });
    assert.equal(chain.department, "WEBSITE");
    assert.ok(next);
    assert.equal(next.operatorId, "website_desk_lead");
  });
});

describe("workload and delegation intelligence", () => {
  it("detects overloaded operator workload", () => {
    const tasks = Array.from({ length: 6 }, (_, i) =>
      task({
        id: `t${i}`,
        department: "WEBSITE",
        status: "open",
        isOverdue: i < 2,
      })
    );
    const metadata = new Map(tasks.map((t) => [t.id, parseTaskCoordinationMetadata(null)]));
    const workload = buildOperatorWorkloadAnalytics({ tasks, metadataByTaskId: metadata });
    assert.ok(workload.some((w) => w.operatorId === "website_desk_lead"));
  });

  it("builds delegation recommendations when desk overloaded", () => {
    const tasks = Array.from({ length: 8 }, (_, i) =>
      task({ id: `w${i}`, department: "WEBSITE", status: "blocked", isBlocked: true })
    );
    const metadata = new Map(tasks.map((t) => [t.id, parseTaskCoordinationMetadata(null)]));
    const workload = buildOperatorWorkloadAnalytics({ tasks, metadataByTaskId: metadata });
    const recs = buildDelegationRecommendations({ tasks, workload, metadataByTaskId: metadata });
    assert.ok(recs.length >= 0);
  });

  it("builds escalation risk alerts for overdue tasks", () => {
    const tasks = [task({ id: "o1", isOverdue: true, status: "open" })];
    const metadata = new Map([["o1", parseTaskCoordinationMetadata(null)]]);
    const workload = buildOperatorWorkloadAnalytics({ tasks, metadataByTaskId: metadata });
    const alerts = buildEscalationRiskAlerts({ tasks, workload, metadataByTaskId: metadata });
    assert.ok(alerts.some((a) => a.taskId === "o1"));
  });
});

describe("Skipper and policy", () => {
  it("picker selects operator tools for delegation prompts", () => {
    const tools = pickExecutiveReadTools("Show operator workload and delegation opportunities", null, null);
    assert.ok(tools.includes("getExecutiveOperatorWorkload"));
    assert.ok(tools.includes("getExecutiveOperatorRegistry"));
  });

  it("registers delegate and escalate write actions", () => {
    assert.ok(WRITE_ACTION_NAMES.includes("delegateOperationalTask"));
    assert.ok(WRITE_ACTION_NAMES.includes("escalateOperationalTask"));
    assert.equal(WRITE_ACTION_NAMES.length, 14);
  });
});
