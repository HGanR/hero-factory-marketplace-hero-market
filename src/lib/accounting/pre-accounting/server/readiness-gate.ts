import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  accountingDocumentRecords,
  accountingReviewItems,
  taxFormCandidates,
} from "@/lib/db/schema.pre-accounting";
import type { HandoffComposition, PreAccountingProfile } from "../types";
import { defaultHandoffComposition } from "../types";
import type { TransactionSnapshot } from "../types";

export type ReadinessGateResult = {
  passed: boolean;
  blockers: string[];
  warnings: string[];
};

/**
 * Evaluates whether profile can move to ready_for_preparer / finalized_for_handoff.
 * Not legal/tax advice — operational checks only.
 */
export function evaluateHandoffReadinessGate(input: {
  profile: PreAccountingProfile;
  ledger: TransactionSnapshot;
  openBlockerReviewItems: number;
  openReviewItemsWaitingOnClient: number;
  documentsWithFileCount: number;
  formsWithMissingSupportNotWaived: number;
  hasUploadedDocumentAcceptedOrInProgress: boolean;
}): ReadinessGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const comp = input.profile.defaultHandoffComposition ?? defaultHandoffComposition();
  if (!comp.includeReadinessSummary || !comp.includeProbableForms) {
    warnings.push("Packet composition omits readiness and/or probable forms — confirm with preparer.");
  }

  if (input.ledger.uncategorizedCount > 0) {
    warnings.push(`${input.ledger.uncategorizedCount} uncategorized ledger transactions may need review.`);
  }

  if (input.openBlockerReviewItems > 0) {
    blockers.push(`${input.openBlockerReviewItems} open blocker review item(s) must be resolved or waived.`);
  }

  if (input.formsWithMissingSupportNotWaived > 0) {
    blockers.push(
      `${input.formsWithMissingSupportNotWaived} probable form(s) still have missing support not waived or resolved.`
    );
  }

  if (input.documentsWithFileCount === 0) {
    warnings.push("No uploaded documents on file — add core records before handoff.");
  }

  if (!input.hasUploadedDocumentAcceptedOrInProgress) {
    warnings.push("No documents in uploaded/needs_review/accepted state — verify intake.");
  }

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
  };
}

function parseMissingJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function loadGateContext(profileId: number) {
  const db = await getDb();
  const [items, forms, docs] = await Promise.all([
    db.select().from(accountingReviewItems).where(eq(accountingReviewItems.accountingProfileId, profileId)),
    db.select().from(taxFormCandidates).where(eq(taxFormCandidates.accountingProfileId, profileId)),
    db.select().from(accountingDocumentRecords).where(eq(accountingDocumentRecords.accountingProfileId, profileId)),
  ]);

  const openBlockerReviewItems = items.filter(
    (i) => i.severity === "blocker" && (i.status === "open" || i.status === "in_progress")
  ).length;
  const openReviewItemsWaitingOnClient = items.filter((i) => i.status === "waiting_on_client").length;

  let formsWithMissingSupportNotWaived = 0;
  for (const f of forms) {
    const missing = parseMissingJson(f.missingSupportJson);
    if (missing.length === 0) continue;
    const sg = f.supportGapStatus ?? "open";
    if (sg === "waived" || sg === "resolved") continue;
    formsWithMissingSupportNotWaived++;
  }

  const documentsWithFileCount = docs.filter((d) => d.storageKey).length;
  const hasUploadedDocumentAcceptedOrInProgress = docs.some((d) =>
    ["uploaded", "needs_review", "accepted"].includes(d.status)
  );

  return {
    openBlockerReviewItems,
    openReviewItemsWaitingOnClient,
    formsWithMissingSupportNotWaived,
    documentsWithFileCount,
    hasUploadedDocumentAcceptedOrInProgress,
  };
}

export async function evaluateHandoffReadinessGateForProfile(
  profileId: number,
  profile: PreAccountingProfile,
  ledger: TransactionSnapshot
): Promise<ReadinessGateResult> {
  const ctx = await loadGateContext(profileId);
  return evaluateHandoffReadinessGate({
    profile,
    ledger,
    openBlockerReviewItems: ctx.openBlockerReviewItems,
    openReviewItemsWaitingOnClient: ctx.openReviewItemsWaitingOnClient,
    documentsWithFileCount: ctx.documentsWithFileCount,
    formsWithMissingSupportNotWaived: ctx.formsWithMissingSupportNotWaived,
    hasUploadedDocumentAcceptedOrInProgress: ctx.hasUploadedDocumentAcceptedOrInProgress,
  });
}
