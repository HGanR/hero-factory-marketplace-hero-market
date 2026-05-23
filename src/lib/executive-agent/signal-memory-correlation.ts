import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getLastExecutiveSessionCheckpoint } from "@/lib/executive-agent/executive-session-memory";
import type { WorkflowContinuitySignal } from "@/lib/executive-agent/executive-workflow-types";

type Db = MySql2Database<typeof schema>;

export type SignalMemoryContext = {
  approvalPattern: string | null;
  workflowPattern: string | null;
  escalationPattern: string | null;
  sessionContinuity: string | null;
  correlateCategory: (category: string) => string | null;
};

export async function correlateSignalMemory(
  db: Db,
  adminUserId: number,
  input: {
    auditActionTypes: string[];
    workflowContinuity: WorkflowContinuitySignal[];
  },
): Promise<SignalMemoryContext> {
  const lastCheckpoint = await getLastExecutiveSessionCheckpoint(db, adminUserId).catch(() => null);

  const approvalSurge = input.auditActionTypes.filter((a) => a.includes("approval")).length;
  const escalationSurge = input.auditActionTypes.filter((a) => a.includes("escalation")).length;
  const degradedWorkflows = input.workflowContinuity.filter((s) => s.risk === "degraded" || s.risk === "broken");

  const approvalPattern =
    approvalSurge >= 4 ? "matches prior approval surge pattern on desk" : approvalSurge >= 2 ? "recent approval activity" : null;

  const workflowPattern =
    degradedWorkflows.length >= 2
      ? "similar to prior multi-workflow instability"
      : degradedWorkflows.length === 1
        ? "continuity gap echoes previous workflow stall"
        : null;

  const escalationPattern =
    escalationSurge >= 3 ? "escalation density elevated vs recent sessions" : escalationSurge >= 1 ? "prior escalation activity" : null;

  const sessionContinuity = lastCheckpoint
    ? `last check-in ${lastCheckpoint.checkedInAt}: ${lastCheckpoint.postureSummary}`
    : null;

  const categoryMap: Record<string, string | null> = {
    approval: approvalPattern,
    workflow: workflowPattern,
    escalation: escalationPattern,
    operator: escalationPattern,
    governance: workflowPattern,
    kpi: sessionContinuity,
    onboarding: sessionContinuity,
  };

  return {
    approvalPattern,
    workflowPattern,
    escalationPattern,
    sessionContinuity,
    correlateCategory: (category) => categoryMap[category] ?? sessionContinuity,
  };
}
