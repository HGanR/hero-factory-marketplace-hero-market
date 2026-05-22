import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";
import type {
  PersistentWorkflowState,
  WorkflowDependencyGraph,
  WorkflowDependencyNode,
  WorkflowEvidenceLink,
} from "@/lib/executive-agent/executive-workflow-types";
import {
  buildTaskDependencyIndex,
  detectCircularDependencies,
  isDependencySatisfied,
  tasksBlockedByDependencies,
} from "@/lib/executive-agent/task-dependency-graph";

export function buildWorkflowDependencyGraph(input: {
  workflow: PersistentWorkflowState;
  tasks: ExecutiveOperationalTaskDto[];
}): WorkflowDependencyGraph {
  const workflowTasks = input.tasks.filter((t) => input.workflow.taskIds.includes(t.id));
  const taskNodes = workflowTasks.map((t) => t.id);
  const cycle = detectCircularDependencies(workflowTasks);
  const blocked = tasksBlockedByDependencies(workflowTasks);
  const index = buildTaskDependencyIndex(workflowTasks);

  const nodes: WorkflowDependencyNode[] = [];

  for (const task of workflowTasks) {
    nodes.push({
      id: `task:${task.id}`,
      workflowId: input.workflow.workflowId,
      label: task.title,
      kind: "task",
      dependsOn: task.dependsOnTaskIds.map((d) => `task:${d}`),
      satisfied: task.status === "completed" || isDependencySatisfied(task, index),
      blocksWorkflow: blocked.has(task.id) || task.status === "blocked",
    });
  }

  for (const approvalId of input.workflow.approvalIds) {
    nodes.push({
      id: `approval:${approvalId}`,
      workflowId: input.workflow.workflowId,
      label: `Approval ${approvalId.slice(0, 8)}…`,
      kind: "approval",
      dependsOn: workflowTasks.filter((t) => t.approvalId === approvalId).map((t) => `task:${t.id}`),
      satisfied: false,
      blocksWorkflow: input.workflow.currentStage === "approval_pending",
    });
  }

  if (input.workflow.department) {
    nodes.push({
      id: `dept:${input.workflow.department}`,
      workflowId: input.workflow.workflowId,
      label: `${input.workflow.department} gate`,
      kind: "department_gate",
      dependsOn: taskNodes.map((id) => `task:${id}`).slice(0, 3),
      satisfied: !input.workflow.paused,
      blocksWorkflow: input.workflow.paused,
    });
  }

  const evidence: WorkflowEvidenceLink[] = [
    { source: "tasks", detail: `${workflowTasks.length} task node(s)` },
  ];
  if (cycle) evidence.push({ source: "inference", detail: `Cycle detected: ${cycle.join(" → ")}` });

  return {
    workflowId: input.workflow.workflowId,
    nodes,
    hasCycle: Boolean(cycle),
    blockedNodeIds: nodes.filter((n) => n.blocksWorkflow).map((n) => n.id),
    evidence,
  };
}

export function buildAllWorkflowDependencyGraphs(input: {
  workflows: PersistentWorkflowState[];
  tasks: ExecutiveOperationalTaskDto[];
}): WorkflowDependencyGraph[] {
  return input.workflows.map((workflow) =>
    buildWorkflowDependencyGraph({ workflow, tasks: input.tasks })
  );
}
