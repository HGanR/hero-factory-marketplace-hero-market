import { and, eq, sql } from "drizzle-orm";

import type { getDb } from "@/lib/db";
import { trustDrafts, trusts } from "@/lib/db/schema";
import { mergeIntakeIntoSmartTrustDraft } from "@/lib/jarva/jarva-trust-orchestrator";
import { evaluateJarvaIntakeReadiness } from "@/lib/jarva/jarva-readiness";
import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";
import { TRUST_INTAKE_SCHEMA_VERSION } from "@/lib/jarva/trust-intake-schema";
import { loadLatestTrustRecordsStore, mergeTrustRecordsStoreFromIntake, persistTrustRecordsStateDraft } from "@/lib/jarva/jarva-trust-records-sync";
import { persistSmartTrustDraft } from "@/lib/trusts/persist-smart-trust-draft";
import { buildWorkspaceSummaryForTrust } from "@/lib/trusts/build-workspace-summary";
import type { WorkspaceSummaryPayload } from "@/lib/trusts/build-workspace-summary";

export type RunJarvaApplyResult =
  | {
      ok: true;
      readiness: ReturnType<typeof evaluateJarvaIntakeReadiness>;
      smartTrustVersion: number;
      smartDraftId: string;
      trustRecordsVersion?: number;
      trustRecordsSynced: boolean;
      /** Same payload as GET /api/trusts/[trustId]/workspace/summary — for immediate UI sync */
      workspaceSummary: WorkspaceSummaryPayload;
    }
  | { ok: false; error: "READINESS_BLOCKED"; readiness: ReturnType<typeof evaluateJarvaIntakeReadiness> };

/**
 * Shared apply: Smart Trust draft + optional Trust Records state merge.
 */
export async function runJarvaTrustApply(params: {
  db: Awaited<ReturnType<typeof getDb>>;
  userId: number;
  trustId: string;
  intake: JarvaTrustIntake;
  force?: boolean;
  /** After Smart Trust persist, merge trust-records-state */
  syncTrustRecords?: boolean;
}): Promise<RunJarvaApplyResult> {
  const { db, userId, trustId, intake, force, syncTrustRecords = true } = params;

  const readiness = evaluateJarvaIntakeReadiness(intake);
  if (!readiness.ok && !force) {
    return { ok: false, error: "READINESS_BLOCKED", readiness };
  }

  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) {
    throw new Error("Trust not found");
  }

  const smartRows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, "smart-trust-draft")))
    .orderBy(sql`version desc`)
    .limit(1);

  let existing: Record<string, unknown> | null = null;
  if (smartRows.length > 0) {
    try {
      const payload = JSON.parse(String(smartRows[0]!.payloadJson ?? "null"));
      existing = (payload?.draft && typeof payload.draft === "object" ? payload.draft : null) as Record<
        string,
        unknown
      > | null;
    } catch {
      existing = null;
    }
  }

  const merged = mergeIntakeIntoSmartTrustDraft(existing, intake);

  const smartResult = await persistSmartTrustDraft({
    db,
    userId,
    trustId,
    trustRow: trustRows[0]!,
    draft: merged,
    schemaVersion: 1,
    meta: { source: "jarva_apply", intakeVersion: TRUST_INTAKE_SCHEMA_VERSION },
    auditAction: "jarva_trust_intake_applied",
  });

  let trustRecordsVersion: number | undefined;
  let trustRecordsSynced = false;

  if (syncTrustRecords) {
    const prevStore = await loadLatestTrustRecordsStore(db, trustId);
    const mergedStore = mergeTrustRecordsStoreFromIntake(prevStore, intake);
    const tr = await persistTrustRecordsStateDraft({
      db,
      userId,
      trustId,
      trustRow: trustRows[0]!,
      store: mergedStore,
    });
    trustRecordsVersion = tr.nextVersion;
    trustRecordsSynced = true;
  }

  const workspaceSummary = await buildWorkspaceSummaryForTrust(db, trustId, userId);
  if (!workspaceSummary) {
    throw new Error("Workspace summary unavailable after apply");
  }

  return {
    ok: true,
    readiness,
    smartTrustVersion: smartResult.nextVersion,
    smartDraftId: smartResult.draftId ?? "",
    trustRecordsVersion,
    trustRecordsSynced,
    workspaceSummary,
  };
}
