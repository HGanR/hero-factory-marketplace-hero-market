import { randomUUID } from "crypto";
import type {
  CrossDepartmentWorkflowLink,
  PersistentWorkflowState,
  WorkflowEvidenceLink,
} from "@/lib/executive-agent/executive-workflow-types";
import { FULFILLMENT_DEPARTMENT_DEPENDENCIES } from "@/lib/fulfillment/department-dependency-map";

export function buildCrossDepartmentWorkflowChains(
  workflows: PersistentWorkflowState[]
): CrossDepartmentWorkflowLink[] {
  const links: CrossDepartmentWorkflowLink[] = [];
  const byClient = new Map<string, PersistentWorkflowState[]>();

  for (const wf of workflows) {
    if (!wf.clientId) continue;
    const hit = byClient.get(wf.clientId) ?? [];
    hit.push(wf);
    byClient.set(wf.clientId, hit);
  }

  for (const [clientId, clientWorkflows] of byClient) {
    const depts = [...new Set(clientWorkflows.map((w) => w.department).filter(Boolean))];
    if (depts.length < 2) continue;

    for (let i = 0; i < clientWorkflows.length; i++) {
      for (let j = i + 1; j < clientWorkflows.length; j++) {
        const a = clientWorkflows[i]!;
        const b = clientWorkflows[j]!;
        if (a.department === b.department) continue;

        const edge = FULFILLMENT_DEPARTMENT_DEPENDENCIES.find(
          (e) =>
            (e.from === a.department && e.to === b.department) ||
            (e.from === b.department && e.to === a.department)
        );

        links.push({
          id: randomUUID(),
          fromWorkflowId: a.workflowId,
          toWorkflowId: b.workflowId,
          fromDepartment: a.department,
          toDepartment: b.department,
          chainKind: edge ? "sequential" : "parallel",
          requiresApproval: true,
          summary: edge?.summary ?? `Cross-department coordination for client ${clientId.slice(0, 8)}…`,
          evidence: [
            { source: "departments", detail: `${a.department ?? "?"} ↔ ${b.department ?? "?"}` },
          ],
        });
      }
    }
  }

  return links.slice(0, 20);
}
