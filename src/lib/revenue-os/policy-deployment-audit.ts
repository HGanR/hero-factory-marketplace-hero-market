/**
 * Audit bridge for Bentley policy change set lifecycle (prepare / save / apply / cancel).
 */

import { writeBentleyAutonomousAuditEntry } from "@/lib/revenue-os/autonomous-audit";

export async function writePolicyChangeSetAudit(input: {
  userId: string;
  clientId?: string;
  trustId?: string;
  actionType:
    | "policy_change_set_prepared"
    | "policy_change_set_saved"
    | "policy_change_set_applied"
    | "policy_change_set_partial_failure"
    | "policy_change_set_failed"
    | "policy_change_set_canceled";
  changeSetId?: string | null;
  runId?: string | null;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
}): Promise<void> {
  await writeBentleyAutonomousAuditEntry({
    userId: input.userId,
    clientId: input.clientId ?? "default",
    trustId: input.trustId ?? "default",
    sourceType: "bentley_policy_change_set",
    actionType: input.actionType,
    actionStatus: "executed",
    relatedRunId: input.runId ?? null,
    actionPayloadJson: {
      changeSetId: input.changeSetId,
      ...(input.payload ?? {}),
    },
    resultPayloadJson: input.result ?? null,
  });
}
