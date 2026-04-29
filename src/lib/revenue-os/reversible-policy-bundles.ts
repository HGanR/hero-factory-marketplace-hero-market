/**
 * Builds upsert payloads matching existing policy upsert API body shapes.
 * Callers apply via governed routes or DB upserts — no parallel apply mechanism.
 */

import { getAutonomousPolicyForUser } from "@/lib/revenue-os/autonomous-policies-db";
import { getAutomationPolicyForUser } from "@/lib/revenue-os/automation-policies-db";
import { getNotificationPolicyForUser } from "@/lib/revenue-os/notification-db";
import { normalizePolicySnapshot } from "@/lib/revenue-os/rollback-packages";
import type { AutomationPolicyType } from "@/lib/revenue-os/automation-policy-helpers";
import { isBentleyAutonomousActionType } from "@/lib/revenue-os/autonomous-types";

export type RollbackUpsertItem = {
  family: "autonomous" | "automation" | "notifications";
  policyId: string;
  payload: Record<string, unknown> | null;
  skipReason?: string;
};

export type BlendedRollbackBundleResult = {
  items: RollbackUpsertItem[];
  partialFailures: Array<{ family: string; policyId: string; reason: string }>;
};

export async function buildAutonomousRollbackUpserts(input: {
  userId: string;
  targetItems: Array<Record<string, unknown>>;
}): Promise<RollbackUpsertItem[]> {
  const out: RollbackUpsertItem[] = [];
  for (const raw of input.targetItems) {
    const id = String(raw.id ?? "").trim();
    if (!id) continue;
    const row = await getAutonomousPolicyForUser({ userId: input.userId, policyId: id });
    if (!row) {
      out.push({
        family: "autonomous",
        policyId: id,
        payload: null,
        skipReason: "no_live_policy_for_id",
      });
      continue;
    }
    const actionType = typeof raw.actionType === "string" ? raw.actionType : row.actionType;
    if (!isBentleyAutonomousActionType(actionType)) {
      out.push({
        family: "autonomous",
        policyId: id,
        payload: null,
        skipReason: "invalid_action_type",
      });
      continue;
    }
    out.push({
      family: "autonomous",
      policyId: id,
      payload: {
        id: row.id,
        clientId: row.clientId,
        trustId: row.trustId,
        actionType,
        isEnabled: typeof raw.isEnabled === "boolean" ? raw.isEnabled : row.isEnabled,
        requiresApprovalAboveSeverity:
          typeof raw.requiresApprovalAboveSeverity === "string"
            ? raw.requiresApprovalAboveSeverity
            : row.requiresApprovalAboveSeverity,
        maxDailyExecutions:
          raw.maxDailyExecutions !== undefined && raw.maxDailyExecutions !== null
            ? Number(raw.maxDailyExecutions)
            : row.maxDailyExecutions,
        cooldownMinutes:
          raw.cooldownMinutes !== undefined && raw.cooldownMinutes !== null
            ? Number(raw.cooldownMinutes)
            : row.cooldownMinutes,
        policyConfigJson:
          raw.policyConfigJson !== undefined ? (raw.policyConfigJson as Record<string, unknown> | null) : row.policyConfigJson,
      },
    });
  }
  return out;
}

export async function buildAutomationRollbackUpserts(input: {
  userId: string;
  targetItems: Array<Record<string, unknown>>;
}): Promise<RollbackUpsertItem[]> {
  const out: RollbackUpsertItem[] = [];
  for (const raw of input.targetItems) {
    const id = String(raw.id ?? "").trim();
    if (!id) continue;
    const row = await getAutomationPolicyForUser({ userId: input.userId, policyId: id });
    if (!row) {
      out.push({ family: "automation", policyId: id, payload: null, skipReason: "no_live_policy_for_id" });
      continue;
    }
    const policyType = (typeof raw.policyType === "string" ? raw.policyType : row.policyType) as AutomationPolicyType;
    out.push({
      family: "automation",
      policyId: id,
      payload: {
        id: row.id,
        clientId: row.clientId,
        trustId: row.trustId,
        policyType,
        isEnabled: typeof raw.isEnabled === "boolean" ? raw.isEnabled : row.isEnabled,
        scheduleJson:
          raw.scheduleJson !== undefined ? (raw.scheduleJson as Record<string, unknown> | null) : row.scheduleJson,
        policyConfigJson:
          raw.policyConfigJson !== undefined ? (raw.policyConfigJson as Record<string, unknown> | null) : row.policyConfigJson,
      },
    });
  }
  return out;
}

export async function buildNotificationRollbackUpserts(input: {
  userId: string;
  targetItems: Array<Record<string, unknown>>;
}): Promise<RollbackUpsertItem[]> {
  const out: RollbackUpsertItem[] = [];
  for (const raw of input.targetItems) {
    const id = String(raw.id ?? "").trim();
    if (!id) continue;
    const row = await getNotificationPolicyForUser({ userId: input.userId, policyId: id });
    if (!row) {
      out.push({ family: "notifications", policyId: id, payload: null, skipReason: "no_live_policy_for_id" });
      continue;
    }
    out.push({
      family: "notifications",
      policyId: id,
      payload: {
        id: row.id,
        clientId: row.clientId,
        trustId: row.trustId,
        eventType: typeof raw.eventType === "string" ? raw.eventType : row.eventType,
        minimumSeverity: typeof raw.minimumSeverity === "string" ? raw.minimumSeverity : row.minimumSeverity,
        channelId: typeof raw.channelId === "string" ? raw.channelId : row.channelId,
        isEnabled: typeof raw.isEnabled === "boolean" ? raw.isEnabled : row.isEnabled,
        policyConfigJson:
          raw.policyConfigJson !== undefined ? (raw.policyConfigJson as Record<string, unknown> | null) : row.policyConfigJson,
      },
    });
  }
  return out;
}

export async function buildBlendedRollbackBundle(input: {
  userId: string;
  rollbackTargetSnapshotJson: Record<string, unknown>;
  families?: Array<"autonomous" | "automation" | "notifications">;
}): Promise<BlendedRollbackBundleResult> {
  const norm = normalizePolicySnapshot(input.rollbackTargetSnapshotJson);
  const want = input.families?.length ? new Set(input.families) : null;
  const partialFailures: Array<{ family: string; policyId: string; reason: string }> = [];
  const items: RollbackUpsertItem[] = [];

  const ingest = async (fam: "autonomous" | "automation" | "notifications", batch: RollbackUpsertItem[]) => {
    if (want && !want.has(fam)) return;
    for (const it of batch) {
      if (!it.payload && it.skipReason) {
        partialFailures.push({ family: fam, policyId: it.policyId, reason: it.skipReason });
      }
      items.push(it);
    }
  };

  await ingest(
    "autonomous",
    await buildAutonomousRollbackUpserts({ userId: input.userId, targetItems: norm.autonomous })
  );
  await ingest(
    "automation",
    await buildAutomationRollbackUpserts({ userId: input.userId, targetItems: norm.automation })
  );
  await ingest(
    "notifications",
    await buildNotificationRollbackUpserts({ userId: input.userId, targetItems: norm.notifications })
  );

  return { items, partialFailures };
}
