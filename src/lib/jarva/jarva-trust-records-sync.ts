import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";

import type { getDb } from "@/lib/db";
import { insertAuditLog } from "@/lib/audit";
import { trustDrafts, trusts } from "@/lib/db/schema";
import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";
import type { TrustRecordsJarvaDraftFields } from "@/lib/trust-records/trust-records-jarva-fields";

const DRAFT_TYPE = "trust-records-state";

/**
 * Merge Jarva intake fields into Trust Records store shape (grantor/trustee names, firm, entity state).
 * Store is the TrustConfig blob used by Trust Records UI.
 */
export function mergeTrustRecordsStoreFromIntake(
  existingStore: Record<string, unknown> | null,
  intake: JarvaTrustIntake
): Record<string, unknown> & Partial<TrustRecordsJarvaDraftFields> {
  const next: Record<string, unknown> & Partial<TrustRecordsJarvaDraftFields> = existingStore
    ? { ...existingStore }
    : {};

  if (intake.trustName?.trim()) next.entityName = intake.trustName.trim();
  if (intake.matterLabel?.trim()) next.consultantName = intake.matterLabel.trim();

  if (intake.grantor?.name?.trim()) next.grantorName = intake.grantor.name.trim();
  if (intake.trustee?.name?.trim()) next.trusteeName = intake.trustee.name.trim();

  if (intake.grantor?.addressLine1) next.grantorAddressLine1 = intake.grantor.addressLine1;
  if (intake.grantor?.addressLine2) next.grantorAddressLine2 = intake.grantor.addressLine2;
  if (intake.grantor?.city) next.grantorCity = intake.grantor.city;
  if (intake.grantor?.state) next.grantorState = intake.grantor.state;
  if (intake.grantor?.postalCode) next.grantorPostalCode = intake.grantor.postalCode;
  if (intake.grantor?.country) next.grantorCountry = intake.grantor.country;

  if (intake.trustee?.addressLine1) next.trusteeAddressLine1 = intake.trustee.addressLine1;
  if (intake.trustee?.city) next.trusteeCity = intake.trustee.city;
  if (intake.trustee?.state) next.trusteeState = intake.trustee.state;
  if (intake.trustee?.postalCode) next.trusteePostalCode = intake.trustee.postalCode;
  if (intake.trustee?.country) next.trusteeCountry = intake.trustee.country;

  if (intake.governingState?.trim()) next.entityState = intake.governingState.trim();

  if (intake.firm?.name) next.firmName = intake.firm.name;
  if (intake.firm?.address) next.firmAddress = intake.firm.address;
  if (intake.firm?.phone) next.firmPhone = intake.firm.phone;
  if (intake.firm?.email) next.firmEmail = intake.firm.email;

  if (intake.objectives?.trim()) next.jarvaObjectivesDraft = intake.objectives.trim().slice(0, 20000);
  if (intake.beneficiariesSummary?.trim()) next.jarvaBeneficiariesSummaryDraft = intake.beneficiariesSummary.trim().slice(0, 20000);
  if (intake.successorTrusteeNote?.trim()) {
    next.jarvaSuccessorTrusteeNote = intake.successorTrusteeNote.trim().slice(0, 5000);
  }
  if (intake.jurisdictionAmbiguityNote?.trim()) {
    next.jarvaJurisdictionAmbiguityNote = intake.jurisdictionAmbiguityNote.trim().slice(0, 2000);
  }
  if (intake.assetScheduleNotesDraft?.trim()) {
    next.jarvaAssetScheduleNotesDraft = intake.assetScheduleNotesDraft.trim().slice(0, 20000);
  }
  if (intake.pourOverWillNeeded === true) {
    next.jarvaPourOverWillIntentFlag = true;
  } else if (intake.pourOverWillNeeded === false) {
    next.jarvaPourOverWillIntentFlag = false;
  }

  next.jarvaTrustRecordsSyncedAt = new Date().toISOString();

  return next;
}

/**
 * Persist merged Trust Records store as new trust-records-state draft version.
 * Ownership: trusts.userId must match (caller verifies).
 */
export async function persistTrustRecordsStateDraft(params: {
  db: Awaited<ReturnType<typeof getDb>>;
  userId: number;
  trustId: string;
  trustRow: { source?: string | null };
  store: Record<string, unknown>;
}): Promise<{ draftId: string; nextVersion: number }> {
  const { db, userId, trustId, trustRow, store } = params;

  const payloadJson = JSON.stringify(store);
  if (Buffer.byteLength(payloadJson, "utf8") > 1024 * 1024) {
    throw new Error("Trust Records state too large");
  }

  const draftId = crypto.randomUUID();
  const result = await db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ maxV: sql<number>`max(${trustDrafts.version})` })
      .from(trustDrafts)
      .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, DRAFT_TYPE)))
      .limit(1);
    const nextVersion = Number(maxRows[0]?.maxV ?? 0) + 1;

    await tx.insert(trustDrafts).values({
      id: draftId,
      trustId,
      draftType: DRAFT_TYPE,
      schemaVersion: 1,
      version: nextVersion,
      payloadJson,
    } as any);

    await tx.update(trusts).set({ source: "trust-records" } as any).where(eq(trusts.id, trustId));

    await insertAuditLog(tx as any, {
      actorUserId: userId,
      action: "jarva_trust_records_state_merged",
      entityType: "trust",
      entityId: trustId,
      metadata: { draftId, version: nextVersion },
    });

    return { nextVersion };
  });

  return { draftId, nextVersion: result.nextVersion };
}

export async function loadLatestTrustRecordsStore(
  db: Awaited<ReturnType<typeof getDb>>,
  trustId: string
): Promise<Record<string, unknown> | null> {
  const rows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, DRAFT_TYPE)))
    .orderBy(sql`version desc`)
    .limit(1);
  if (rows.length === 0) return null;
  try {
    const raw = JSON.parse(String(rows[0]!.payloadJson ?? "null"));
    return typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
