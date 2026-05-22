import type {
  ExecutiveOperationalTaskDto,
} from "@/lib/executive-agent/executive-operational-tasks";
import type {
  ExecutiveOperationalThreadDto,
} from "@/lib/executive-agent/executive-conversation-threads";
import type {
  PersistentWorkflowState,
  WorkflowEvidenceLink,
  WorkflowLifecycleStage,
  WorkflowStageRecord,
} from "@/lib/executive-agent/executive-workflow-types";

function workflowKey(input: {
  clientId: string | null;
  orderId: string | null;
  department: ExecutiveOperationalTaskDto["department"];
}): string {
  if (input.orderId) return `wf:order:${input.orderId}`;
  if (input.clientId && input.department) return `wf:client:${input.clientId}:${input.department}`;
  if (input.clientId) return `wf:client:${input.clientId}:platform`;
  return `wf:desk:platform`;
}

function inferStage(input: {
  tasks: ExecutiveOperationalTaskDto[];
  threads: ExecutiveOperationalThreadDto[];
  approvalIds: string[];
  pendingApprovals: number;
  paused: boolean;
}): WorkflowLifecycleStage {
  if (input.paused) return "paused";
  if (input.tasks.some((t) => t.status === "blocked")) return "blocked";
  if (input.pendingApprovals > 0 || input.approvalIds.some(Boolean)) return "approval_pending";
  if (input.tasks.some((t) => t.approvalId && t.status === "in_progress")) return "approved_execution";
  if (input.tasks.every((t) => t.status === "completed" || t.status === "canceled") && input.tasks.length > 0) {
    return "execution_complete";
  }
  if (input.tasks.some((t) => t.status === "open" || t.status === "in_progress")) return "coordination";
  if (input.threads.some((t) => t.decisionNeeded)) return "coordination";
  return "intake";
}

function buildStages(current: WorkflowLifecycleStage): WorkflowStageRecord[] {
  const order: WorkflowLifecycleStage[] = [
    "intake",
    "coordination",
    "approval_pending",
    "approved_execution",
    "execution_complete",
  ];
  const idx = order.indexOf(current === "paused" || current === "blocked" || current === "recovery" ? "coordination" : current);

  return order.map((stage, i) => ({
    stage,
    label: stage.replace(/_/g, " "),
    status:
      current === "paused" && stage === "coordination"
        ? "paused"
        : current === "blocked" && i === idx
          ? "blocked"
          : i < idx
            ? "complete"
            : i === idx
              ? "active"
              : "pending",
    requiresApproval: stage === "approval_pending" || stage === "approved_execution",
    reversible: stage !== "execution_complete",
    evidence: [{ source: "inference", detail: `Lifecycle stage ${stage}` }],
  }));
}

export function buildPersistentWorkflowStates(input: {
  tasks: ExecutiveOperationalTaskDto[];
  threads: ExecutiveOperationalThreadDto[];
  approvals: Array<{ id: string; status: string; targetId: string | null }>;
  pausedWorkflowIds: Set<string>;
  pauseMetaByWorkflowId: Map<string, { pausedAt: string; rationale: string }>;
}): PersistentWorkflowState[] {
  const groups = new Map<string, {
    tasks: ExecutiveOperationalTaskDto[];
    threads: ExecutiveOperationalThreadDto[];
    department: ExecutiveOperationalTaskDto["department"];
    clientId: string | null;
    orderId: string | null;
  }>();

  for (const task of input.tasks) {
    const id = workflowKey({ clientId: task.clientId, orderId: task.orderId, department: task.department });
    const hit = groups.get(id) ?? {
      tasks: [],
      threads: [],
      department: task.department,
      clientId: task.clientId,
      orderId: task.orderId,
    };
    hit.tasks.push(task);
    groups.set(id, hit);
  }

  for (const thread of input.threads) {
    const id = workflowKey({
      clientId: thread.clientId,
      orderId: thread.orderId,
      department: thread.department,
    });
    const hit = groups.get(id) ?? {
      tasks: [],
      threads: [],
      department: thread.department,
      clientId: thread.clientId,
      orderId: thread.orderId,
    };
    hit.threads.push(thread);
    groups.set(id, hit);
  }

  if (groups.size === 0) {
    groups.set("wf:desk:platform", {
      tasks: [],
      threads: [],
      department: null,
      clientId: null,
      orderId: null,
    });
  }

  return [...groups.entries()].map(([workflowId, group]) => {
    const approvalIds = [
      ...new Set([
        ...group.tasks.map((t) => t.approvalId).filter(Boolean) as string[],
        ...group.threads.map((t) => t.approvalId).filter(Boolean) as string[],
      ]),
    ];
    const pendingApprovals = input.approvals.filter(
      (a) => a.status === "pending" && approvalIds.includes(a.id)
    ).length;
    const paused = input.pausedWorkflowIds.has(workflowId);
    const pauseMeta = input.pauseMetaByWorkflowId.get(workflowId);
    const currentStage = inferStage({
      tasks: group.tasks,
      threads: group.threads,
      approvalIds,
      pendingApprovals,
      paused,
    });

    const continuityScore = Math.max(
      20,
      100 -
        group.tasks.filter((t) => t.status === "blocked").length * 15 -
        pendingApprovals * 10 -
        (paused ? 25 : 0)
    );

    const evidence: WorkflowEvidenceLink[] = [
      { source: "tasks", detail: `${group.tasks.length} task(s) in workflow` },
      { source: "threads", detail: `${group.threads.length} thread(s) linked` },
    ];
    if (pendingApprovals > 0) {
      evidence.push({ source: "approvals", detail: `${pendingApprovals} pending approval(s)` });
    }

    const title =
      group.clientId && group.department
        ? `${group.department} workflow — ${group.clientId.slice(0, 8)}…`
        : group.orderId
          ? `Order workflow — ${group.orderId.slice(0, 8)}…`
          : "Executive desk workflow";

    return {
      workflowId,
      title,
      department: group.department,
      clientId: group.clientId,
      orderId: group.orderId,
      currentStage,
      paused,
      pausedAt: pauseMeta?.pausedAt ?? null,
      pausedRationale: pauseMeta?.rationale ?? null,
      taskIds: group.tasks.map((t) => t.id),
      threadIds: group.threads.map((t) => t.id),
      approvalIds,
      stages: buildStages(currentStage),
      continuityScore,
      evidence,
    } satisfies PersistentWorkflowState;
  });
}

export function findWorkflowStateById(
  states: PersistentWorkflowState[],
  workflowId: string
): PersistentWorkflowState | null {
  return states.find((w) => w.workflowId === workflowId) ?? null;
}
