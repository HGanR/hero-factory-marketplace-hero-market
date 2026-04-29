/**
 * Governed execution for Bentley policy change sets (explicit confirmation required for apply).
 */

import {
  getPolicyChangeSetByIdForUser,
  insertChangeSetRun,
  listChangeSetItems,
  listChangeSetRuns,
  updateChangeSetItem,
  updateChangeSetRun,
  updatePolicyChangeSet,
  type PolicyChangeSetItemRow,
  type PolicyChangeSetRow,
  type PolicyChangeSetRunRow,
} from "@/lib/revenue-os/policy-change-sets-db";
import { applyBentleyPolicyUpsertItem } from "@/lib/revenue-os/policy-upsert-apply";
import type { RollbackUpsertItem } from "@/lib/revenue-os/reversible-policy-bundles";
import { emitPolicyDeploymentNotification } from "@/lib/revenue-os/policy-deployment-notifications";

export type ChangeSetState = {
  changeSet: PolicyChangeSetRow;
  items: PolicyChangeSetItemRow[];
  runs: PolicyChangeSetRunRow[];
};

function rollbackItemFromRow(row: PolicyChangeSetItemRow): RollbackUpsertItem | null {
  const payload = row.payloadJson;
  if (!payload || typeof payload !== "object") return null;
  return {
    family: row.policyFamily as RollbackUpsertItem["family"],
    policyId: String((payload as Record<string, unknown>).id ?? ""),
    payload: payload as Record<string, unknown>,
  };
}

export async function fetchBentleyPolicyChangeSetState(input: {
  userId: string;
  changeSetId: string;
}): Promise<ChangeSetState | null> {
  const cs = await getPolicyChangeSetByIdForUser({ userId: input.userId, changeSetId: input.changeSetId });
  if (!cs) return null;
  const [items, runs] = await Promise.all([
    listChangeSetItems({ changeSetId: cs.id }),
    listChangeSetRuns({ changeSetId: cs.id, limit: 20 }),
  ]);
  return { changeSet: cs, items, runs };
}

export async function applyBentleyPolicyChangeSetItem(input: {
  userId: string;
  itemId: string;
  changeSetId: string;
  runId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const st = await fetchBentleyPolicyChangeSetState({ userId: input.userId, changeSetId: input.changeSetId });
  if (!st) return { ok: false, error: "change_set_not_found" };
  const row = st.items.find((i) => i.id === input.itemId);
  if (!row) return { ok: false, error: "item_not_found" };
  if (row.itemStatus === "skipped") return { ok: false, error: "skipped" };
  const item = rollbackItemFromRow(row);
  if (!item) return { ok: false, error: "no_payload" };

  const auditFamily =
    row.policyFamily === "notifications"
      ? "change_set_apply_notification"
      : row.policyFamily === "automation"
        ? "change_set_apply_automation"
        : "change_set_apply_autonomous";

  const r = await applyBentleyPolicyUpsertItem({
    userId: input.userId,
    item,
    audit: {
      sourceType: "bentley_policy_change_set",
      relatedRunId: input.runId,
      bundleId: input.changeSetId,
      actionType: auditFamily,
    },
  });

  await updateChangeSetItem({
    itemId: row.id,
    itemStatus: r.ok ? "applied" : "failed",
    resultJson: r.ok ? { ok: true } : { ok: false, error: r.error },
  });

  return r;
}

export async function applyBentleyPolicyChangeSet(input: {
  userId: string;
  changeSetId: string;
  /** Explicit operator confirmation — required. */
  confirm: boolean;
}): Promise<{
  ok: boolean;
  runId: string | null;
  applied: number;
  failed: number;
  skipped: number;
  errors: string[];
  changeSetStatus: string;
}> {
  if (!input.confirm) {
    return {
      ok: false,
      runId: null,
      applied: 0,
      failed: 0,
      skipped: 0,
      errors: ["confirmation_required"],
      changeSetStatus: "ready",
    };
  }

  const st = await fetchBentleyPolicyChangeSetState({ userId: input.userId, changeSetId: input.changeSetId });
  if (!st) {
    return {
      ok: false,
      runId: null,
      applied: 0,
      failed: 0,
      skipped: 0,
      errors: ["change_set_not_found"],
      changeSetStatus: "failed",
    };
  }

  await updatePolicyChangeSet({ changeSetId: st.changeSet.id, status: "active" });

  const run = await insertChangeSetRun({
    changeSetId: st.changeSet.id,
    runStatus: "started",
    runSummaryJson: { phase: "apply_started" },
    startedAt: new Date(),
  });
  if (!run) {
    await updatePolicyChangeSet({ changeSetId: st.changeSet.id, status: "failed" });
    return {
      ok: false,
      runId: null,
      applied: 0,
      failed: 0,
      skipped: 0,
      errors: ["could_not_create_run"],
      changeSetStatus: "failed",
    };
  }

  let applied = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  const items = [...st.items].sort((a, b) => a.itemOrder - b.itemOrder);
  for (const row of items) {
    if (row.itemStatus === "skipped" || !row.payloadJson) {
      skipped += 1;
      continue;
    }
    const r = await applyBentleyPolicyChangeSetItem({
      userId: input.userId,
      itemId: row.id,
      changeSetId: st.changeSet.id,
      runId: run.id,
    });
    if (r.ok) applied += 1;
    else {
      failed += 1;
      if (r.error) errors.push(`${row.policyFamily} ${row.id}: ${r.error}`);
    }
  }

  const partial = applied > 0 && failed > 0;
  const allFailed = applied === 0 && failed > 0;
  const runStatus = partial ? "partial" : allFailed ? "failed" : failed === 0 && skipped === items.length ? "failed" : "completed";

  const finalCsStatus =
    partial
      ? "partially_applied"
      : allFailed || (applied === 0 && skipped === items.length)
        ? "failed"
        : "completed";

  await updateChangeSetRun({
    runId: run.id,
    runStatus,
    completedAt: new Date(),
    runSummaryJson: { applied, failed, skipped, errors },
  });

  await updatePolicyChangeSet({ changeSetId: st.changeSet.id, status: finalCsStatus });

  if (partial) {
    await emitPolicyDeploymentNotification({
      userId: input.userId,
      kind: "policy_change_set_partial_failure",
      changeSetId: st.changeSet.id,
      title: "Policy deployment partially applied",
      body: `${applied} succeeded, ${failed} failed — review change set items.`,
      payload: { runId: run.id, applied, failed },
    });
  } else if (runStatus === "completed" && applied > 0) {
    await emitPolicyDeploymentNotification({
      userId: input.userId,
      kind: "policy_change_set_applied",
      changeSetId: st.changeSet.id,
      title: "Policy change set applied",
      body: `Applied ${applied} policy upsert(s).`,
      payload: { runId: run.id, applied },
    });
  } else if (runStatus === "failed") {
    await emitPolicyDeploymentNotification({
      userId: input.userId,
      kind: "policy_change_set_failed",
      changeSetId: st.changeSet.id,
      title: "Policy deployment failed",
      body: errors.slice(0, 3).join(" · ") || "All items failed or were skipped.",
      payload: { runId: run.id, errors },
    });
  }

  return {
    ok: applied > 0,
    runId: run.id,
    applied,
    failed,
    skipped,
    errors,
    changeSetStatus: finalCsStatus,
  };
}

export async function cancelBentleyPolicyChangeSet(input: { userId: string; changeSetId: string }): Promise<boolean> {
  const st = await fetchBentleyPolicyChangeSetState({ userId: input.userId, changeSetId: input.changeSetId });
  if (!st) return false;
  await updatePolicyChangeSet({ changeSetId: st.changeSet.id, status: "failed" });
  const latest = st.runs[0];
  if (latest && latest.runStatus === "started") {
    await updateChangeSetRun({
      runId: latest.id,
      runStatus: "canceled",
      completedAt: new Date(),
      runSummaryJson: { ...(latest.runSummaryJson as object), canceled: true },
    });
  }
  await emitPolicyDeploymentNotification({
    userId: input.userId,
    kind: "policy_change_set_canceled",
    changeSetId: st.changeSet.id,
    title: "Policy change set canceled",
    body: "Deployment marked canceled — no further applies on this run.",
    payload: {},
  });
  return true;
}
