import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeBlockedOperationalTasks, canStartTask } from "@/lib/executive-agent/blocked-task-analysis";
import {
  buildSkipperOperationalTasksContext,
  isTaskOverdue,
  parseDependsOnTaskIdsJson,
} from "@/lib/executive-agent/executive-operational-tasks";
import { buildExecutiveTaskRecommendations } from "@/lib/executive-agent/executive-task-recommendations";
import {
  detectCircularDependencies,
  isDependencySatisfied,
  tasksBlockedByDependencies,
} from "@/lib/executive-agent/task-dependency-graph";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";

function task(
  partial: Partial<{
    id: string;
    status: "open" | "in_progress" | "blocked" | "completed" | "canceled";
    dependsOnTaskIds: string[];
    orderId: string | null;
    department: "WEBSITE" | "TRUST" | null;
    dueAt: string | null;
    priority: "low" | "normal" | "high" | "urgent";
  }>
) {
  return {
    id: partial.id ?? "t1",
    title: "Task",
    description: "desc",
    status: partial.status ?? "open",
    priority: partial.priority ?? "normal",
    ownerLabel: "executive_owner",
    department: partial.department ?? null,
    recommendedAgent: null,
    decisionId: null,
    threadId: null,
    approvalId: null,
    orderId: partial.orderId ?? null,
    clientId: null,
    subjectId: null,
    blockedReason: null,
    blockedAt: null,
    dueAt: partial.dueAt ?? null,
    startedAt: null,
    completedAt: null,
    dependsOnTaskIds: partial.dependsOnTaskIds ?? [],
    createdAt: "",
    updatedAt: "",
    isOverdue: false,
    isBlocked: partial.status === "blocked",
    dependencyBlocked: false,
  };
}

describe("task dependency graph", () => {
  it("detects unsatisfied dependencies", () => {
    const tasks = [
      { id: "a", status: "open" as const, dependsOnTaskIds: [], title: "A" },
      { id: "b", status: "open" as const, dependsOnTaskIds: ["a"], title: "B" },
    ];
    assert.equal(isDependencySatisfied(tasks[1]!, new Map(tasks.map((t) => [t.id, t]))), false);
    const blocked = tasksBlockedByDependencies(tasks);
    assert.ok(blocked.has("b"));
  });

  it("detects circular dependencies", () => {
    const cycle = detectCircularDependencies([
      { id: "a", status: "open", dependsOnTaskIds: ["b"], title: "A" },
      { id: "b", status: "open", dependsOnTaskIds: ["a"], title: "B" },
    ]);
    assert.ok(cycle);
  });
});

describe("blocked task analysis", () => {
  it("flags fulfillment bottlenecks", () => {
    const analysis = analyzeBlockedOperationalTasks([
      task({ id: "x", status: "blocked", orderId: "ord-1", department: "TRUST" }),
    ]);
    assert.equal(analysis.fulfillmentBottlenecks.length, 1);
  });

  it("prevents start when dependencies incomplete", () => {
    const t = task({ id: "b", dependsOnTaskIds: ["a"] });
    const index = new Map([
      ["a", { id: "a", status: "open" as const, dependsOnTaskIds: [] }],
      ["b", t],
    ]);
    assert.equal(canStartTask(t, index).ok, false);
  });
});

describe("task recommendations", () => {
  it("recommends overdue open tasks", () => {
    const recs = buildExecutiveTaskRecommendations([
      task({
        id: "o1",
        status: "open",
        dueAt: new Date(Date.now() - 86_400_000).toISOString(),
        priority: "urgent",
      }),
    ]);
    assert.ok(recs.length >= 1);
    assert.match(recs[0]!.rationale, /Overdue|owner/i);
  });
});

describe("executive operational tasks helpers", () => {
  it("parses dependency json", () => {
    assert.deepEqual(parseDependsOnTaskIdsJson('["a","b"]'), ["a", "b"]);
  });

  it("detects overdue", () => {
    const overdue = task({
      status: "in_progress",
      dueAt: new Date(Date.now() - 1000).toISOString(),
    });
    assert.equal(isTaskOverdue(overdue), true);
  });

  it("builds skipper context with no-autonomous guard", () => {
    const ctx = buildSkipperOperationalTasksContext({
      open: [task({ id: "1" })],
      blocked: [],
      overdue: [],
      recommendations: [],
    });
    assert.match(ctx, /no autonomous/i);
  });
});

describe("read tool picker", () => {
  it("selects operational tasks tool", () => {
    const tools = pickExecutiveReadTools("What operational tasks are blocked or overdue?", null);
    assert.ok(tools.includes("getExecutiveOperationalTasks"));
  });
});
