/**
 * UI-ready payloads for rollback workbench (cards, tables, checklist).
 */

import type { BentleyRollbackEngineResult } from "@/lib/revenue-os/rollback-packages";
import type { BlendedRollbackBundleResult, RollbackUpsertItem } from "@/lib/revenue-os/reversible-policy-bundles";
import type { PolicyRollbackPackageRow } from "@/lib/revenue-os/policy-rollback-db";

export function buildRollbackPackageSummaryCard(input: {
  name: string;
  rollbackType: string;
  affectedFamilies: string[];
  deltaSummary: string;
}) {
  return {
    id: "rollback_summary",
    title: input.name,
    subtitle: `Type: ${input.rollbackType}`,
    detail: input.deltaSummary.slice(0, 600),
    families: input.affectedFamilies,
  };
}

export function buildBeforeAfterFamilyCards(input: {
  currentLabel?: string;
  targetLabel?: string;
  families: Array<{ key: string; label: string; currentCount: number; targetCount: number }>;
}) {
  return {
    beforeTitle: input.currentLabel ?? "Current live (captured)",
    afterTitle: input.targetLabel ?? "Rollback target",
    cards: input.families,
  };
}

export function buildRollbackDeltaTable(deltaJson: Record<string, unknown>) {
  const rows: Array<{ id: string; family: string; detail: string }> = [];
  for (const fam of ["autonomous", "automation", "notifications"] as const) {
    const block = deltaJson[fam] as { changes?: Array<Record<string, unknown>> } | undefined;
    const changes = block?.changes ?? [];
    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      const id = String(c.id ?? i);
      const detail =
        c.fieldDiffs && typeof c.fieldDiffs === "object"
          ? JSON.stringify(c.fieldDiffs).slice(0, 400)
          : String(c.note ?? c.kind ?? "change");
      rows.push({ id: `${fam}_${id}_${i}`, family: fam, detail });
    }
  }
  return { rows };
}

export function buildAffectedScopeCards(scopes: BentleyRollbackEngineResult["affectedScopes"]) {
  return scopes.map((s, i) => ({
    id: `scope_${i}`,
    clientId: s.clientId,
    trustId: s.trustId,
    label: s.label,
  }));
}

export function buildRollbackReviewChecklist(input: {
  staleWarning?: string | null;
  partialFailureCount: number;
  itemCount: number;
}) {
  return [
    { id: "c1", label: "Rollback target matches scenario baseline or embedded snapshot", done: true },
    { id: "c2", label: "Payload previews reviewed for each policy id", done: false },
    {
      id: "c3",
      label: input.staleWarning ? `Re-check: ${input.staleWarning}` : "Live policy state verified against package",
      done: !input.staleWarning,
    },
    {
      id: "c4",
      label:
        input.partialFailureCount > 0
          ? `${input.partialFailureCount} policy row(s) will be skipped — confirm acceptable`
          : "No partial skips detected",
      done: input.partialFailureCount === 0,
    },
    { id: "c5", label: `${input.itemCount} upsert(s) in bundle`, done: input.itemCount > 0 },
  ];
}

export function buildConfirmationPayloadPreview(items: RollbackUpsertItem[]) {
  return items
    .filter((i) => i.payload)
    .map((i, idx) => ({
      id: `prev_${idx}`,
      family: i.family,
      policyId: i.policyId,
      preview: i.payload as Record<string, unknown>,
    }));
}

export function buildApplyResultSummary(input: {
  applied: number;
  failed: number;
  skipped: number;
  errors: string[];
}) {
  return {
    headline: input.failed === 0 ? "Rollback apply completed" : "Rollback apply finished with errors",
    applied: input.applied,
    failed: input.failed,
    skipped: input.skipped,
    errors: input.errors.slice(0, 12),
  };
}

export function buildRollbackWorkbenchUiPayload(input: {
  engine: BentleyRollbackEngineResult;
  packageRow: PolicyRollbackPackageRow | null;
  bundle: BlendedRollbackBundleResult | null;
  staleWarning?: string | null;
}) {
  const cur = input.engine.rollbackPackage.currentPolicySnapshotJson as Record<string, unknown>;
  const tgt = input.engine.rollbackPackage.rollbackTargetSnapshotJson as Record<string, unknown>;
  const ca = (cur.autonomous as unknown[])?.length ?? 0;
  const cb = (cur.automation as unknown[])?.length ?? 0;
  const cn = (cur.notifications as unknown[])?.length ?? 0;
  const ta = (tgt.autonomous as unknown[])?.length ?? 0;
  const tb = (tgt.automation as unknown[])?.length ?? 0;
  const tn = (tgt.notifications as unknown[])?.length ?? 0;

  const items = input.bundle?.items ?? [];
  const previews = buildConfirmationPayloadPreview(items);

  return {
    summary: buildRollbackPackageSummaryCard({
      name: input.engine.rollbackPackage.name,
      rollbackType: input.engine.rollbackPackage.rollbackType,
      affectedFamilies: input.engine.affectedPolicyFamilies,
      deltaSummary: input.engine.deltaSummary,
    }),
    beforeAfter: buildBeforeAfterFamilyCards({
      families: [
        { key: "autonomous", label: "Autonomous", currentCount: ca, targetCount: ta },
        { key: "automation", label: "Automation / cadence", currentCount: cb, targetCount: tb },
        { key: "notifications", label: "Notifications", currentCount: cn, targetCount: tn },
      ],
    }),
    deltaTable: buildRollbackDeltaTable(input.engine.rollbackPackage.deltaJson as Record<string, unknown>),
    scopes: buildAffectedScopeCards(input.engine.affectedScopes),
    checklist: buildRollbackReviewChecklist({
      staleWarning: input.staleWarning ?? null,
      partialFailureCount: input.bundle?.partialFailures.length ?? 0,
      itemCount: previews.length,
    }),
    confirmationPreviews: previews,
    riskLines: input.engine.riskSummary.lines,
    recommendation: input.engine.recommendation,
    partialFailures: input.bundle?.partialFailures ?? [],
    packageId: input.packageRow?.id ?? null,
  };
}
