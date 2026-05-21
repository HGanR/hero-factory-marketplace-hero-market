import type { ExecutiveOperationalTaskDto } from "@/lib/executive-agent/executive-operational-tasks";

export type TaskGraphNode = Pick<
  ExecutiveOperationalTaskDto,
  "id" | "status" | "dependsOnTaskIds" | "title"
>;

export function buildTaskDependencyIndex(tasks: TaskGraphNode[]): Map<string, TaskGraphNode> {
  return new Map(tasks.map((t) => [t.id, t]));
}

export function isDependencySatisfied(
  task: TaskGraphNode,
  index: Map<string, TaskGraphNode>
): boolean {
  if (!task.dependsOnTaskIds.length) return true;
  return task.dependsOnTaskIds.every((depId) => {
    const dep = index.get(depId);
    return dep?.status === "completed";
  });
}

export function tasksBlockedByDependencies(
  tasks: TaskGraphNode[],
  index?: Map<string, TaskGraphNode>
): Set<string> {
  const map = index ?? buildTaskDependencyIndex(tasks);
  const blocked = new Set<string>();
  for (const t of tasks) {
    if (t.status === "completed" || t.status === "canceled") continue;
    if (!isDependencySatisfied(t, map)) blocked.add(t.id);
  }
  return blocked;
}

export function topologicalTaskOrder(tasks: TaskGraphNode[]): TaskGraphNode[] {
  const index = buildTaskDependencyIndex(tasks);
  const visited = new Set<string>();
  const out: TaskGraphNode[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const t = index.get(id);
    if (!t) return;
    for (const dep of t.dependsOnTaskIds) visit(dep);
    out.push(t);
  }

  for (const t of tasks) visit(t.id);
  return out;
}

export function detectCircularDependencies(tasks: TaskGraphNode[]): string[] | null {
  const index = buildTaskDependencyIndex(tasks);
  const visiting = new Set<string>();
  const done = new Set<string>();

  function dfs(id: string, path: string[]): string[] | null {
    if (done.has(id)) return null;
    if (visiting.has(id)) return [...path, id];
    visiting.add(id);
    const t = index.get(id);
    if (t) {
      for (const dep of t.dependsOnTaskIds) {
        const cycle = dfs(dep, [...path, id]);
        if (cycle) return cycle;
      }
    }
    visiting.delete(id);
    done.add(id);
    return null;
  }

  for (const t of tasks) {
    const cycle = dfs(t.id, []);
    if (cycle) return cycle;
  }
  return null;
}
