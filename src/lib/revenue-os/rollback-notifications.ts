/**
 * In-app notification events for rollback packages (uses insertNotificationEvent).
 */

import { insertNotificationEvent } from "@/lib/revenue-os/notification-db";

export type RollbackNotificationKind =
  | "rollback_package_prepared"
  | "rollback_package_saved"
  | "rollback_package_applied"
  | "rollback_package_failed";

export async function emitRollbackPackageNotification(input: {
  userId: string;
  clientId: string;
  trustId: string;
  kind: RollbackNotificationKind;
  packageId: string;
  title: string;
  body: string;
  payload?: Record<string, unknown> | null;
}): Promise<{ ok: boolean }> {
  const severity =
    input.kind === "rollback_package_failed" ? "critical" : input.kind === "rollback_package_applied" ? "warning" : "info";

  const eventType = input.kind;

  const r = await insertNotificationEvent({
    userId: input.userId,
    clientId: input.clientId || "default",
    trustId: input.trustId || "default",
    sourceType: "bentley_policy_rollback",
    eventType,
    severity,
    title: input.title.slice(0, 512),
    body: input.body.slice(0, 2000),
    eventPayloadJson: { packageId: input.packageId, ...(input.payload ?? {}) },
    dedupeKey: `rollback:${input.packageId}:${eventType}:${new Date().toISOString().slice(0, 13)}`,
  });

  return { ok: r.ok };
}
