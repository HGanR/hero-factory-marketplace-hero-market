/**
 * In-app notification events for coordinated policy deployments (change sets).
 */

import { insertNotificationEvent } from "@/lib/revenue-os/notification-db";

export type PolicyDeploymentNotificationKind =
  | "policy_change_set_prepared"
  | "policy_change_set_saved"
  | "policy_change_set_applied"
  | "policy_change_set_partial_failure"
  | "policy_change_set_failed"
  | "policy_change_set_canceled";

export async function emitPolicyDeploymentNotification(input: {
  userId: string;
  clientId?: string;
  trustId?: string;
  kind: PolicyDeploymentNotificationKind;
  changeSetId: string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
}): Promise<{ ok: boolean }> {
  const severity =
    input.kind === "policy_change_set_failed" || input.kind === "policy_change_set_partial_failure"
      ? "critical"
      : input.kind === "policy_change_set_applied"
        ? "warning"
        : "info";

  const r = await insertNotificationEvent({
    userId: input.userId,
    clientId: input.clientId || "default",
    trustId: input.trustId || "default",
    sourceType: "bentley_policy_change_set",
    eventType: input.kind,
    severity,
    title: input.title.slice(0, 512),
    body: input.body.slice(0, 2000),
    eventPayloadJson: { changeSetId: input.changeSetId, ...(input.payload ?? {}) },
    dedupeKey: `cs:${input.changeSetId}:${input.kind}:${new Date().toISOString().slice(0, 13)}`,
  });

  return { ok: r.ok };
}
