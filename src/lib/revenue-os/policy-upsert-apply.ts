/**
 * Single-policy upsert apply used by rollback runs and coordinated change-set deployments.
 */

import { upsertAutonomousPolicy } from "@/lib/revenue-os/autonomous-policies-db";
import { upsertAutomationPolicy } from "@/lib/revenue-os/automation-policies-db";
import { upsertNotificationPolicy } from "@/lib/revenue-os/notification-db";
import { computeNextAutomationRunAt } from "@/lib/revenue-os/automation-policy-helpers";
import type { AutomationPolicyType } from "@/lib/revenue-os/automation-policy-helpers";
import { writeBentleyAutonomousAuditEntry } from "@/lib/revenue-os/autonomous-audit";
import type { RollbackUpsertItem } from "@/lib/revenue-os/reversible-policy-bundles";
import { isBentleyAutonomousActionType } from "@/lib/revenue-os/autonomous-types";

export type PolicyUpsertAuditContext = {
  sourceType: "bentley_policy_rollback" | "bentley_policy_change_set";
  relatedRunId?: string | null;
  /** e.g. rollback package id or change set id */
  bundleId?: string | null;
  /** Stored on audit rows — keep aligned with rollback / change-set routes. */
  actionType: string;
};

export async function applyBentleyPolicyUpsertItem(input: {
  userId: string;
  item: RollbackUpsertItem;
  audit: PolicyUpsertAuditContext;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, item, audit } = input;
  if (!item.payload) {
    return { ok: false, error: item.skipReason ?? "no_payload" };
  }
  const p = item.payload as Record<string, unknown>;
  const cid = String(p.clientId ?? "");
  const tid = String(p.trustId ?? "");

  if (item.family === "autonomous") {
    const actionType = p.actionType;
    if (!isBentleyAutonomousActionType(String(actionType))) {
      return { ok: false, error: "invalid_action_type" };
    }
    const r = await upsertAutonomousPolicy({
      userId,
      id: String(p.id),
      clientId: cid,
      trustId: tid,
      actionType: actionType as import("@/lib/revenue-os/autonomous-types").BentleyAutonomousActionType,
      isEnabled: Boolean(p.isEnabled),
      requiresApprovalAboveSeverity: String(p.requiresApprovalAboveSeverity ?? "critical"),
      maxDailyExecutions: p.maxDailyExecutions != null ? Number(p.maxDailyExecutions) : null,
      cooldownMinutes: p.cooldownMinutes != null ? Number(p.cooldownMinutes) : null,
      policyConfigJson: (p.policyConfigJson as Record<string, unknown> | null) ?? null,
    });
    if (!r.ok) return { ok: false, error: "autonomous_upsert_failed" };
    await writeBentleyAutonomousAuditEntry({
      userId,
      clientId: cid,
      trustId: tid,
      sourceType: audit.sourceType,
      actionType: audit.actionType,
      actionStatus: "executed",
      relatedRunId: audit.relatedRunId ?? undefined,
      actionPayloadJson: {
        bundleId: audit.bundleId,
        policyId: item.policyId,
      },
      resultPayloadJson: { ok: true },
    });
    return { ok: true };
  }

  if (item.family === "automation") {
    const policyType = p.policyType as AutomationPolicyType;
    const nextRunAt = computeNextAutomationRunAt({
      policyType,
      lastRunAt: null,
      scheduleJson: p.scheduleJson as Record<string, unknown> | undefined,
      nowMs: Date.now(),
    });
    const r = await upsertAutomationPolicy({
      userId,
      id: String(p.id),
      clientId: cid,
      trustId: tid,
      policyType,
      isEnabled: Boolean(p.isEnabled),
      scheduleJson: (p.scheduleJson as Record<string, unknown> | null) ?? null,
      policyConfigJson: (p.policyConfigJson as Record<string, unknown> | null) ?? null,
      nextRunAt,
    });
    if (!r.ok) return { ok: false, error: "automation_upsert_failed" };
    await writeBentleyAutonomousAuditEntry({
      userId,
      clientId: cid,
      trustId: tid,
      sourceType: audit.sourceType,
      actionType: audit.actionType,
      actionStatus: "executed",
      relatedRunId: audit.relatedRunId ?? undefined,
      actionPayloadJson: { bundleId: audit.bundleId, policyId: item.policyId },
      resultPayloadJson: { ok: true },
    });
    return { ok: true };
  }

  if (item.family === "notifications") {
    const r = await upsertNotificationPolicy({
      userId,
      id: String(p.id),
      clientId: cid,
      trustId: tid,
      eventType: String(p.eventType),
      minimumSeverity: String(p.minimumSeverity),
      channelId: String(p.channelId),
      isEnabled: Boolean(p.isEnabled),
      policyConfigJson: (p.policyConfigJson as Record<string, unknown> | null) ?? null,
    });
    if (!r.ok) return { ok: false, error: "notification_upsert_failed" };
    await writeBentleyAutonomousAuditEntry({
      userId,
      clientId: cid,
      trustId: tid,
      sourceType: audit.sourceType,
      actionType: audit.actionType,
      actionStatus: "executed",
      relatedRunId: audit.relatedRunId ?? undefined,
      actionPayloadJson: { bundleId: audit.bundleId, policyId: item.policyId },
      resultPayloadJson: { ok: true },
    });
    return { ok: true };
  }

  return { ok: false, error: "unknown_family" };
}
