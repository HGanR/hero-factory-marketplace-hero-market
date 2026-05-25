/**
 * Rollback package engine — builds snapshots, deltas, and summaries (no live mutation).
 */

import { buildBentleyPolicyWorkbench } from "@/lib/revenue-os/policy-tuning-workbench";
import { getPolicyRolloutPlanByIdForUser } from "@/lib/revenue-os/policy-rollout-db";
import { getPolicyScenarioByIdForUser } from "@/lib/revenue-os/policy-scenarios-db";
import type { BentleyRollbackType } from "@/lib/revenue-os/policy-rollback-db";

export type NormalizedPolicySnapshot = {
  autonomous: Array<Record<string, unknown>>;
  automation: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
};

export type BentleyRollbackPackagePayload = {
  currentPolicySnapshotJson: Record<string, unknown>;
  rollbackTargetSnapshotJson: Record<string, unknown>;
  deltaJson: Record<string, unknown>;
  rationaleJson: Record<string, unknown>;
  rollbackType: BentleyRollbackType;
  name: string;
  sourceRolloutPlanId: string | null;
  sourceScenarioId: string | null;
};

export type BentleyRollbackEngineResult = {
  rollbackPackage: BentleyRollbackPackagePayload;
  deltaSummary: string;
  riskSummary: { lines: string[] };
  recommendation: string;
  affectedScopes: Array<{ clientId: string; trustId: string; label: string }>;
  affectedPolicyFamilies: Array<"autonomous" | "automation" | "notifications">;
};

export function normalizePolicySnapshot(raw: unknown): NormalizedPolicySnapshot {
  if (!raw || typeof raw !== "object") {
    return { autonomous: [], automation: [], notifications: [] };
  }
  const o = raw as Record<string, unknown>;
  const arr = (x: unknown): Array<Record<string, unknown>> =>
    (Array.isArray(x) ? x : []).filter((p) => p && typeof p === "object") as Array<Record<string, unknown>>;
  return {
    autonomous: arr(o.autonomous),
    automation: arr(o.automation),
    notifications: arr(o.notifications),
  };
}

function diffFamily(
  family: "autonomous" | "automation" | "notifications",
  current: Array<Record<string, unknown>>,
  target: Array<Record<string, unknown>>
): { changes: Array<Record<string, unknown>>; changedIds: string[] } {
  const curById = new Map(current.map((x) => [String(x.id ?? ""), x]));
  const tgtById = new Map(target.map((x) => [String(x.id ?? ""), x]));
  const changes: Array<Record<string, unknown>> = [];
  const changedIds = new Set<string>();

  for (const [id, t] of tgtById) {
    if (!id) continue;
    const c = curById.get(id);
    if (!c) {
      changes.push({ id, kind: "target_without_live_row", family, note: "Rollback references a policy id not present live — apply may skip unless policy exists." });
      changedIds.add(id);
      continue;
    }
    const keys = new Set([...Object.keys(c), ...Object.keys(t)]);
    const fieldDiffs: Record<string, { before: unknown; after: unknown }> = {};
    for (const k of keys) {
      if (k === "id") continue;
      const b = c[k];
      const a = t[k];
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        fieldDiffs[k] = { before: b, after: a };
      }
    }
    if (Object.keys(fieldDiffs).length > 0) {
      changes.push({ id, family, fieldDiffs });
      changedIds.add(id);
    }
  }

  for (const [id, c] of curById) {
    if (!id || tgtById.has(id)) continue;
    changes.push({
      id,
      family,
      kind: "live_not_in_target",
      note: "Live policy not listed in rollback target — it will be unchanged by this bundle.",
    });
  }

  return { changes, changedIds: [...changedIds] };
}

export function computeRollbackDeltaJson(input: {
  current: NormalizedPolicySnapshot;
  target: NormalizedPolicySnapshot;
}): {
  deltaJson: Record<string, unknown>;
  affectedPolicyFamilies: Array<"autonomous" | "automation" | "notifications">;
} {
  const autonomous = diffFamily("autonomous", input.current.autonomous, input.target.autonomous);
  const automation = diffFamily("automation", input.current.automation, input.target.automation);
  const notifications = diffFamily("notifications", input.current.notifications, input.target.notifications);

  const material = (d: { changes: Array<Record<string, unknown>> }) =>
    d.changes.some((c) => c.fieldDiffs && typeof c.fieldDiffs === "object");

  const affected: Array<"autonomous" | "automation" | "notifications"> = [];
  if (material(autonomous) || autonomous.changedIds.length) affected.push("autonomous");
  if (material(automation) || automation.changedIds.length) affected.push("automation");
  if (material(notifications) || notifications.changedIds.length) affected.push("notifications");

  return {
    deltaJson: {
      autonomous,
      automation,
      notifications,
      generatedAt: new Date().toISOString(),
    },
    affectedPolicyFamilies: affected,
  };
}

async function resolveRollbackTargetSnapshot(input: {
  userId: string;
  sourceRolloutPlanId?: string | null;
  sourceScenarioId?: string | null;
}): Promise<{
  target: Record<string, unknown>;
  rationale: Record<string, unknown>;
  sourceRolloutPlanId: string | null;
  sourceScenarioId: string | null;
}> {
  let sourceScenarioId = input.sourceScenarioId?.trim() || null;
  let sourceRolloutPlanId = input.sourceRolloutPlanId?.trim() || null;
  let target: Record<string, unknown> = {};
  const lines: string[] = [];
  let source: "scenario" | "rollout_plan" | "embedded" = "embedded";

  if (sourceScenarioId) {
    const sc = await getPolicyScenarioByIdForUser({ userId: input.userId, scenarioId: sourceScenarioId });
    if (sc?.basePolicySnapshotJson && typeof sc.basePolicySnapshotJson === "object") {
      target = sc.basePolicySnapshotJson as Record<string, unknown>;
      lines.push(`Rollback target: baseline snapshot from scenario "${sc.name}".`);
      source = "scenario";
    } else {
      lines.push("Scenario baseline missing — using empty target (partial rollback only).");
    }
    return {
      target,
      rationale: { source, scenarioName: sc?.name, lines },
      sourceRolloutPlanId,
      sourceScenarioId,
    };
  }

  if (sourceRolloutPlanId) {
    const plan = await getPolicyRolloutPlanByIdForUser({ userId: input.userId, planId: sourceRolloutPlanId });
    if (!plan) {
      return {
        target: {},
        rationale: { source: "embedded", lines: ["Rollout plan not found — empty target."] },
        sourceRolloutPlanId,
        sourceScenarioId: null,
      };
    }
    lines.push(`Source rollout plan: "${plan.name}".`);
    if (plan.sourceScenarioId?.trim()) {
      sourceScenarioId = plan.sourceScenarioId.trim();
      const sc = await getPolicyScenarioByIdForUser({ userId: input.userId, scenarioId: sourceScenarioId });
      if (sc?.basePolicySnapshotJson && typeof sc.basePolicySnapshotJson === "object") {
        target = sc.basePolicySnapshotJson as Record<string, unknown>;
        lines.push(`Using linked scenario baseline "${sc.name}" as rollback target.`);
        source = "scenario";
      }
    }
    if (!Object.keys(target).length && plan.rollbackPlanJson && typeof plan.rollbackPlanJson === "object") {
      const rp = plan.rollbackPlanJson as Record<string, unknown>;
      const emb = rp.targetPolicySnapshotJson ?? rp.rollbackTargetSnapshotJson;
      if (emb && typeof emb === "object") {
        target = emb as Record<string, unknown>;
        lines.push("Using embedded rollbackPlanJson.targetPolicySnapshotJson on the rollout plan.");
        source = "embedded";
      }
    }
    if (!Object.keys(target).length) {
      lines.push("No baseline in plan — target snapshot empty; prepare a scenario or embed targetPolicySnapshotJson in rollbackPlanJson.");
    }
    return {
      target,
      rationale: { source, planName: plan.name, lines, sourceScenarioId },
      sourceRolloutPlanId,
      sourceScenarioId,
    };
  }

  return {
    target: {},
    rationale: { source: "embedded", lines: ["No plan or scenario — empty rollback target."] },
    sourceRolloutPlanId: null,
    sourceScenarioId: null,
  };
}

function scopeLabel(clientId: string, trustId: string): string {
  const c = clientId || "default";
  const t = trustId || "default";
  return `${c}/${t}`;
}

export async function buildBentleyRollbackPackage(input: {
  userId: string;
  clientId?: string | null;
  trustId?: string | null;
  sourceRolloutPlanId?: string | null;
  sourceScenarioId?: string | null;
  rollbackType: BentleyRollbackType;
  name?: string;
}): Promise<BentleyRollbackEngineResult> {
  const uid = String(input.userId).trim();
  let clientId = input.clientId?.trim() || undefined;
  let trustId = input.trustId?.trim() || undefined;

  if (input.sourceScenarioId?.trim()) {
    const sc = await getPolicyScenarioByIdForUser({ userId: uid, scenarioId: input.sourceScenarioId.trim() });
    if (sc?.clientId?.trim()) clientId = sc.clientId.trim();
    if (sc?.trustId?.trim()) trustId = sc.trustId.trim();
  } else if (input.sourceRolloutPlanId?.trim()) {
    const plan = await getPolicyRolloutPlanByIdForUser({ userId: uid, planId: input.sourceRolloutPlanId.trim() });
    const sj = plan?.scopeJson;
    if (sj && typeof sj === "object") {
      const o = sj as Record<string, unknown>;
      if (typeof o.clientId === "string" && o.clientId.trim()) clientId = o.clientId.trim();
      if (typeof o.trustId === "string" && o.trustId.trim()) trustId = o.trustId.trim();
    }
  }

  const wb = await buildBentleyPolicyWorkbench({ userId: uid, clientId: clientId ?? null, trustId: trustId ?? null });
  const currentNorm = normalizePolicySnapshot(wb.basePolicySnapshotJson);

  const resolved = await resolveRollbackTargetSnapshot({
    userId: uid,
    sourceRolloutPlanId: input.sourceRolloutPlanId,
    sourceScenarioId: input.sourceScenarioId,
  });

  const targetNorm = normalizePolicySnapshot(resolved.target);
  const { deltaJson, affectedPolicyFamilies } = computeRollbackDeltaJson({
    current: currentNorm,
    target: targetNorm,
  });

  const typeFiltered = filterFamiliesByRollbackType(input.rollbackType, affectedPolicyFamilies);
  const deltaSummary = summarizeDelta(deltaJson, typeFiltered);
  const riskLines = buildRiskLines(currentNorm, targetNorm, deltaJson);
  const recommendation = buildRecommendation(typeFiltered, riskLines);

  const affectedScopes =
    clientId || trustId
      ? [{ clientId: clientId ?? "", trustId: trustId ?? "", label: scopeLabel(clientId ?? "", trustId ?? "") }]
      : [{ clientId: "", trustId: "", label: "All workspaces in account scope" }];

  const name =
    input.name?.trim() ||
    `Rollback ${resolved.sourceScenarioId ? "scenario baseline" : resolved.sourceRolloutPlanId ? "rollout plan" : "package"} — ${new Date().toISOString().slice(0, 10)}`;

  const rollbackPackage: BentleyRollbackPackagePayload = {
    currentPolicySnapshotJson: wb.basePolicySnapshotJson,
    rollbackTargetSnapshotJson: resolved.target,
    deltaJson,
    rationaleJson: {
      ...resolved.rationale,
      rolloutType: input.rolloutType,
      workbenchEmpty: wb.empty,
      currentPoliciesSummary: wb.currentPoliciesSummary,
    },
    rollbackType: input.rolloutType,
    name,
    sourceRolloutPlanId: resolved.sourceRolloutPlanId,
    sourceScenarioId: resolved.sourceScenarioId,
  };

  return {
    rollbackPackage,
    deltaSummary,
    riskSummary: { lines: riskLines },
    recommendation,
    affectedScopes,
    affectedPolicyFamilies: typeFiltered,
  };
}

function filterFamiliesByRollbackType(
  t: BentleyRollbackType,
  families: Array<"autonomous" | "automation" | "notifications">
): Array<"autonomous" | "automation" | "notifications"> {
  if (t === "blended") return families;
  if (t === "autonomous") return families.filter((f) => f === "autonomous");
  if (t === "cadence") return families.filter((f) => f === "automation");
  if (t === "notifications") return families.filter((f) => f === "notifications");
  return families;
}

function summarizeDelta(deltaJson: Record<string, unknown>, families: string[]): string {
  const parts: string[] = [];
  for (const f of ["autonomous", "automation", "notifications"] as const) {
    if (!families.includes(f)) continue;
    const block = deltaJson[f] as { changes?: unknown[]; changedIds?: string[] } | undefined;
    const n = block?.changedIds?.length ?? (Array.isArray(block?.changes) ? block!.changes!.length : 0);
    if (n) parts.push(`${f}: ${n} change(s)`);
  }
  return parts.length ? parts.join("; ") : "No policy field differences detected vs target — verify baseline snapshot.";
}

function buildRiskLines(
  current: NormalizedPolicySnapshot,
  target: NormalizedPolicySnapshot,
  deltaJson: Record<string, unknown>
): string[] {
  const lines: string[] = [];
  const totalLive = current.autonomous.length + current.automation.length + current.notifications.length;
  const totalTarget = target.autonomous.length + target.automation.length + target.notifications.length;
  if (totalLive === 0) {
    lines.push("Sparse live policy state — rollback bundle may be mostly no-op.");
  }
  if (totalTarget === 0) {
    lines.push("Empty rollback target — confirm scenario baseline or embedded snapshot.");
  }
  const auto = deltaJson.autonomous as { changes?: Array<Record<string, unknown>> } | undefined;
  const missing = auto?.changes?.filter((c) => c.kind === "target_without_live_row") ?? [];
  if (missing.length) {
    lines.push(`${missing.length} autonomous target row(s) have no matching live policy — those upserts will be skipped.`);
  }
  return lines;
}

function buildRecommendation(families: string[], risks: string[]): string {
  if (!families.length) {
    return "No matching policy family changes — widen rollback type or fix baseline snapshot.";
  }
  if (risks.some((r) => r.includes("Empty rollback target"))) {
    return "Prepare a scenario baseline or embed targetPolicySnapshotJson before governed apply.";
  }
  return `Bentley recommends reviewed apply for: ${families.join(", ")} — confirm payload previews match intent.`;
}

export async function compareBentleyRollbackAgainstCurrent(input: {
  userId: string;
  clientId?: string | null;
  trustId?: string | null;
  /** Snapshot captured when the package was prepared */
  packageCurrentSnapshot: Record<string, unknown>;
}): Promise<{ stale: boolean; driftSummary: string }> {
  const wb = await buildBentleyPolicyWorkbench({
    userId: input.userId,
    clientId: input.clientId ?? null,
    trustId: input.trustId ?? null,
  });
  const a = JSON.stringify(normalizePolicySnapshot(wb.basePolicySnapshotJson));
  const b = JSON.stringify(normalizePolicySnapshot(input.packageCurrentSnapshot));
  const stale = a !== b;
  return {
    stale,
    driftSummary: stale
      ? "Live policies changed since this package was prepared — re-run prepare before apply."
      : "Live policy snapshot matches package capture.",
  };
}

export function summarizeBentleyRollbackPackage(input: {
  deltaJson: Record<string, unknown>;
  rollbackType: string;
  affectedPolicyFamilies: string[];
  name?: string;
}): { summaryLines: string[]; title: string } {
  const title = input.name?.trim() || "Rollback package";
  const lines: string[] = [];
  lines.push(`Type: ${input.rolloutType}; families: ${input.affectedPolicyFamilies.join(", ") || "none"}.`);
  lines.push(summarizeDelta(input.deltaJson, input.affectedPolicyFamilies));
  return { summaryLines: lines, title };
}
