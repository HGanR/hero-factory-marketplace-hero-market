import { and, asc, desc, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  accountingAuditLog,
  accountingDocumentRecords,
  accountingProfiles,
  accountingReadinessSnapshots,
  accountingQuarterlyWorkflows,
  taxFormCandidates,
  taxPreparerHandoffs,
} from "@/lib/db/schema.pre-accounting";
import type { HandoffComposition, PreAccountingProfile, QuarterlyId, TransactionSnapshot } from "../types";
import { defaultHandoffComposition } from "../types";
import { computeAccountingReadiness } from "../compute-readiness";
import { computeTaxFormCandidates } from "../tax-form-candidates";
import { preAccountingProfileToRowPatch, rowToPreAccountingProfile } from "./profile-map";
import { insertAccountingAuditLog } from "./audit";
import { buildAndStoreHandoffZip, type HandoffPayload } from "./handoff-bundle";
import { enrichFormCandidatesForProfile, parseRequiredRecordsFromUsualRecords } from "./form-candidate-enrichment";
import { listReviewItemsForProfile } from "./review-items";
import { buildWorkspaceCompletenessSnapshot } from "./completeness";
import { evaluateHandoffReadinessGateForProfile } from "./readiness-gate";

const QUARTER_IDS: QuarterlyId[] = ["Q1", "Q2", "Q3", "Q4"];

async function syncQuarterlyWorkflows(profileId: number, profile: PreAccountingProfile, actorId: number) {
  const db = await getDb();
  const existingQ = await db
    .select()
    .from(accountingQuarterlyWorkflows)
    .where(eq(accountingQuarterlyWorkflows.accountingProfileId, profileId));
  const closeoutByQuarter = new Map(existingQ.map((r) => [r.quarterLabel, r.closeoutJson]));
  await db
    .delete(accountingQuarterlyWorkflows)
    .where(eq(accountingQuarterlyWorkflows.accountingProfileId, profileId));
  await db.insert(accountingQuarterlyWorkflows).values(
    QUARTER_IDS.map((q) => {
      const st = profile.quarterly[q];
      const status =
        st.statementsUploaded && st.reconciled
          ? "ready_for_preparer"
          : st.statementsUploaded || st.reconciled
            ? "in_review"
            : "draft";
      return {
        accountingProfileId: profileId,
        quarterLabel: q,
        checklistJson: JSON.stringify({
          statementsUploaded: st.statementsUploaded,
          reconciled: st.reconciled,
          estimatedTaxLogged: st.estimatedTaxLogged,
        }),
        closeoutJson: closeoutByQuarter.get(q) ?? null,
        notes: st.notes,
        status,
      };
    })
  );
  await insertAccountingAuditLog({
    accountingProfileId: profileId,
    actorId,
    actionType: "quarterly_workflow_updated",
    entityType: "accounting_quarterly_workflows",
    entityId: String(profileId),
  });
}

export async function getProfileByUserAndYear(userId: number, taxYear: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(accountingProfiles)
    .where(and(eq(accountingProfiles.userId, userId), eq(accountingProfiles.taxYear, taxYear)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertProfile(
  userId: number,
  profile: PreAccountingProfile,
  actorId: number
): Promise<{ id: number; profile: PreAccountingProfile }> {
  const db = await getDb();
  const patch = preAccountingProfileToRowPatch(profile, userId);
  const existing = await getProfileByUserAndYear(userId, profile.taxYear);

  if (existing) {
    const mergedPatch = { ...patch };
    if (profile.handoffReadinessOverrideNote === undefined) {
      mergedPatch.handoffReadinessOverrideNote = existing.handoffReadinessOverrideNote;
      mergedPatch.handoffReadinessOverrideAt = existing.handoffReadinessOverrideAt;
    }
    await db
      .update(accountingProfiles)
      .set({
        ...mergedPatch,
        reviewStatus: mergedPatch.reviewStatus,
      })
      .where(eq(accountingProfiles.id, existing.id));
    await insertAccountingAuditLog({
      accountingProfileId: existing.id,
      actorId,
      actionType: "profile_updated",
      entityType: "accounting_profiles",
      entityId: String(existing.id),
      metadata: { taxYear: profile.taxYear },
    });
    await syncQuarterlyWorkflows(existing.id, profile, actorId);
    const row = await db.select().from(accountingProfiles).where(eq(accountingProfiles.id, existing.id)).limit(1);
    const p = rowToPreAccountingProfile(row[0]!);
    return { id: existing.id, profile: p };
  }

  await db.insert(accountingProfiles).values(patch);
  const created = await getProfileByUserAndYear(userId, profile.taxYear);
  if (!created) {
    throw new Error("Failed to create accounting profile");
  }
  await insertAccountingAuditLog({
    accountingProfileId: created.id,
    actorId,
    actionType: "profile_created",
    entityType: "accounting_profiles",
    entityId: String(created.id),
    metadata: { taxYear: profile.taxYear },
  });
  await syncQuarterlyWorkflows(created.id, profile, actorId);
  return { id: created.id, profile: rowToPreAccountingProfile(created) };
}

export async function recomputeReadinessAndForms(
  profileId: number,
  profile: PreAccountingProfile,
  ledger: TransactionSnapshot,
  actorId: number
) {
  const db = await getDb();
  const readiness = computeAccountingReadiness(profile, ledger);
  const forms = computeTaxFormCandidates(profile, ledger);

  await db.insert(accountingReadinessSnapshots).values({
    accountingProfileId: profileId,
    bookkeepingScore: readiness.bookkeepingCompletenessScore,
    missingDocumentsJson: JSON.stringify(readiness.missingDocumentsChecklist),
    unresolvedItemsCount: readiness.unresolvedLedgerItems,
    quarterReadinessJson: JSON.stringify(readiness.quarterlyReadiness),
    yearEndStatus: readiness.yearEndReadiness,
    handoffPercent: readiness.handoffReadinessPercent,
  });

  const existingForms = await db
    .select()
    .from(taxFormCandidates)
    .where(eq(taxFormCandidates.accountingProfileId, profileId));
  const preserve = new Map(
    existingForms.map((r) => [
      r.formCode,
      {
        reviewerStatus: r.reviewerStatus,
        reviewerNotes: r.reviewerNotes,
        supportGapStatus: r.supportGapStatus,
        supportGapNote: r.supportGapNote,
      },
    ])
  );

  await db.delete(taxFormCandidates).where(eq(taxFormCandidates.accountingProfileId, profileId));
  if (forms.length > 0) {
    await db.insert(taxFormCandidates).values(
      forms.map((f, i) => {
        const req = parseRequiredRecordsFromUsualRecords(f.usualRecords);
        const prev = preserve.get(f.id);
        return {
          accountingProfileId: profileId,
          formCode: f.id,
          displayName: f.name,
          rationale: [f.whyMayApply, f.usualRecords, f.dateRangesOrThresholds].filter(Boolean).join("\n"),
          supportNeededJson: JSON.stringify({ usualRecords: f.usualRecords, thresholds: f.dateRangesOrThresholds }),
          requiredRecordsJson: JSON.stringify(req),
          status: f.status,
          reviewerStatus: prev?.reviewerStatus ?? "pending_review",
          reviewerNotes: prev?.reviewerNotes ?? null,
          supportGapStatus: prev?.supportGapStatus ?? "open",
          supportGapNote: prev?.supportGapNote ?? null,
          sortOrder: i,
        };
      })
    );
  }

  await enrichFormCandidatesForProfile(profileId);

  await insertAccountingAuditLog({
    accountingProfileId: profileId,
    actorId,
    actionType: "readiness_recomputed",
    entityType: "accounting_readiness_snapshots",
    entityId: String(profileId),
    metadata: { handoffPercent: readiness.handoffReadinessPercent },
  });
}

export async function loadWorkspaceState(userId: number, taxYear: number) {
  const db = await getDb();
  const profileRow = await getProfileByUserAndYear(userId, taxYear);
  if (!profileRow) {
    return {
      profile: null as PreAccountingProfile | null,
      documents: [] as Awaited<ReturnType<typeof listDocuments>>,
      readinessSnapshot: null as Awaited<ReturnType<typeof latestReadiness>>,
      formCandidates: [] as Awaited<ReturnType<typeof listFormCandidates>>,
      handoffs: [] as Awaited<ReturnType<typeof listHandoffs>>,
      auditLog: [] as Awaited<ReturnType<typeof listAudit>>,
      quarterlyWorkflows: [] as Awaited<ReturnType<typeof listQuarterlyWorkflows>>,
      reviewItems: [] as Awaited<ReturnType<typeof listReviewItemsForProfile>>,
      completenessSnapshot: null as ReturnType<typeof buildWorkspaceCompletenessSnapshot> | null,
      readinessGate: null as Awaited<ReturnType<typeof evaluateHandoffReadinessGateForProfile>> | null,
    };
  }
  const profileId = profileRow.id;
  const [documents, readinessSnapshot, formCandidates, handoffs, auditLog, quarterlyWorkflows, reviewItems] =
    await Promise.all([
      listDocuments(profileId),
      latestReadiness(profileId),
      listFormCandidates(profileId),
      listHandoffs(profileId),
      listAudit(profileId),
      listQuarterlyWorkflows(profileId),
      listReviewItemsForProfile(profileId),
    ]);
  const profile = rowToPreAccountingProfile(profileRow);
  const ledgerProxy: TransactionSnapshot = {
    incomeCount: 0,
    expenseCount: 0,
    totalTransactions: 0,
    uncategorizedCount: readinessSnapshot?.unresolvedItemsCount ?? 0,
  };
  const readinessGate = await evaluateHandoffReadinessGateForProfile(profileId, profile, ledgerProxy);
  const completenessSnapshot = buildWorkspaceCompletenessSnapshot({
    quarterlyWorkflows: quarterlyWorkflows.map((q) => ({
      quarterLabel: q.quarterLabel,
      status: q.status,
      checklistJson: q.checklistJson,
      closeoutJson: q.closeoutJson ?? null,
    })),
    formCandidates: formCandidates.map((f) => ({
      formCode: f.formCode,
      missingSupportJson: f.missingSupportJson,
      attachedDocumentIdsJson: f.attachedDocumentIdsJson,
      supportGapStatus: f.supportGapStatus,
      reviewerStatus: f.reviewerStatus,
    })),
    gatePassed: readinessGate.passed,
    reviewItems: reviewItems.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      severity: r.severity,
      status: r.status,
    })),
  });
  return {
    profile,
    documents,
    readinessSnapshot,
    formCandidates,
    handoffs,
    auditLog,
    quarterlyWorkflows,
    reviewItems,
    completenessSnapshot,
    readinessGate,
  };
}

async function listDocuments(profileId: number) {
  const db = await getDb();
  return db
    .select()
    .from(accountingDocumentRecords)
    .where(eq(accountingDocumentRecords.accountingProfileId, profileId))
    .orderBy(desc(accountingDocumentRecords.updatedAt));
}

async function latestReadiness(profileId: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(accountingReadinessSnapshots)
    .where(eq(accountingReadinessSnapshots.accountingProfileId, profileId))
    .orderBy(desc(accountingReadinessSnapshots.computedAt))
    .limit(1);
  return rows[0] ?? null;
}

async function listFormCandidates(profileId: number) {
  const db = await getDb();
  return db
    .select()
    .from(taxFormCandidates)
    .where(eq(taxFormCandidates.accountingProfileId, profileId))
    .orderBy(asc(taxFormCandidates.sortOrder));
}

async function listHandoffs(profileId: number) {
  const db = await getDb();
  return db
    .select()
    .from(taxPreparerHandoffs)
    .where(eq(taxPreparerHandoffs.accountingProfileId, profileId))
    .orderBy(desc(taxPreparerHandoffs.createdAt))
    .limit(20);
}

async function listAudit(profileId: number) {
  const db = await getDb();
  return db
    .select()
    .from(accountingAuditLog)
    .where(eq(accountingAuditLog.accountingProfileId, profileId))
    .orderBy(desc(accountingAuditLog.createdAt))
    .limit(50);
}

async function listQuarterlyWorkflows(profileId: number) {
  const db = await getDb();
  return db
    .select()
    .from(accountingQuarterlyWorkflows)
    .where(eq(accountingQuarterlyWorkflows.accountingProfileId, profileId))
    .orderBy(asc(accountingQuarterlyWorkflows.quarterLabel));
}

function mergeHandoffComposition(profile: PreAccountingProfile, override?: HandoffComposition): HandoffComposition {
  const base = profile.defaultHandoffComposition ?? defaultHandoffComposition();
  if (!override) return base;
  return { ...base, ...override };
}

type AccountingDocRow = InferSelectModel<typeof accountingDocumentRecords>;

function resolveZipDocumentIds(docs: AccountingDocRow[], c: HandoffComposition): number[] {
  const withStorage = docs.filter((d) => d.storageKey);
  let ids = withStorage.filter((d) => d.includeInHandoff !== false).map((d) => d.id);
  if (c.includeDocumentIds && c.includeDocumentIds.length > 0) {
    const allow = new Set(c.includeDocumentIds);
    ids = ids.filter((id) => allow.has(id));
  }
  const exclude = new Set(c.excludeDocumentIds);
  ids = ids.filter((id) => !exclude.has(id));
  return ids;
}

export async function createHandoffPacket(
  userId: number,
  profileId: number,
  profile: PreAccountingProfile,
  ledger: TransactionSnapshot,
  packetName: string,
  compositionOverride?: HandoffComposition
): Promise<{ handoffId: number; bundleUrl: string }> {
  const db = await getDb();
  const readiness = computeAccountingReadiness(profile, ledger);
  const forms = computeTaxFormCandidates(profile, ledger);
  const composition = mergeHandoffComposition(profile, compositionOverride);

  const summaryText = [
    `Tax year ${profile.taxYear}`,
    `Entity: ${profile.filerEntityType}`,
    `Handoff readiness (heuristic): ${readiness.handoffReadinessPercent}%`,
    `Bookkeeping completeness: ${readiness.bookkeepingCompletenessScore}%`,
  ].join("\n\n");

  await db.insert(taxPreparerHandoffs).values({
    accountingProfileId: profileId,
    packetName,
    summaryText,
    packetStatus: "ready_for_review",
    probableFormsJson: JSON.stringify(forms),
    missingItemsJson: JSON.stringify(readiness.missingDocumentsChecklist),
    preparerNotes: profile.preparerNotes,
    compositionJson: JSON.stringify(composition),
  });

  const rows = await db
    .select()
    .from(taxPreparerHandoffs)
    .where(eq(taxPreparerHandoffs.accountingProfileId, profileId))
    .orderBy(desc(taxPreparerHandoffs.createdAt))
    .limit(1);
  const handoff = rows[0];
  if (!handoff) throw new Error("handoff insert failed");

  await insertAccountingAuditLog({
    accountingProfileId: profileId,
    actorId: userId,
    actionType: "handoff_packet_generated",
    entityType: "tax_preparer_handoffs",
    entityId: String(handoff.id),
  });

  const docRows = await db
    .select()
    .from(accountingDocumentRecords)
    .where(eq(accountingDocumentRecords.accountingProfileId, profileId));

  const zipIds = resolveZipDocumentIds(docRows, composition);

  const formRows = await listFormCandidates(profileId);
  const probableFormsPayload = composition.includeProbableForms
    ? formRows.length > 0
      ? formRows.map((r) => ({
          formCode: r.formCode,
          displayName: r.displayName,
          rationale: r.rationale,
          status: r.status,
          reviewerStatus: r.reviewerStatus,
          requiredRecords: safeParseStringArray(r.requiredRecordsJson),
          attachedDocumentIds: safeParseNumberArray(r.attachedDocumentIdsJson),
          missingSupport: safeParseStringArray(r.missingSupportJson),
        }))
      : forms.map((f) => ({
          id: f.id,
          name: f.name,
          whyMayApply: f.whyMayApply,
          status: f.status,
        }))
    : [];

  const quarterlyRows = await listQuarterlyWorkflows(profileId);
  const quarterlyBreakdown =
    composition.includeQuarterBreakdown && quarterlyRows.length > 0
      ? Object.fromEntries(
          quarterlyRows.map((q) => [
            q.quarterLabel,
            { status: q.status, checklist: safeParseJson(q.checklistJson), notes: q.notes },
          ])
        )
      : null;

  const profileSummary: Record<string, unknown> = {
    taxYear: profile.taxYear,
    entityType: profile.filerEntityType,
    accountingBasis: profile.accountingBasis,
  };
  if (composition.includePreparerNotes) profileSummary.preparerNotes = profile.preparerNotes;
  if (composition.includeInternalReviewerNotes) profileSummary.internalReviewNotes = profile.internalReviewNotes ?? "";

  const readinessPayload = composition.includeReadinessSummary
    ? {
        bookkeepingCompletenessScore: readiness.bookkeepingCompletenessScore,
        missingDocumentsChecklist: readiness.missingDocumentsChecklist,
        unresolvedLedgerItems: readiness.unresolvedLedgerItems,
        quarterlyReadiness: readiness.quarterlyReadiness,
        yearEndReadiness: readiness.yearEndReadiness,
        handoffReadinessPercent: readiness.handoffReadinessPercent,
      }
    : null;

  const unresolvedLedgerSummary =
    composition.includeUnresolvedLedgerSummary
      ? {
          uncategorizedCount: ledger.uncategorizedCount,
          totalTransactions: ledger.totalTransactions,
          note: "Heuristic flags from workspace — preparer validates.",
        }
      : composition.includeUnresolvedQuestions
        ? {
            openItems:
              "Review internal notes and document statuses in the workspace (this packet may omit detail per composition).",
          }
        : null;

  const payload: HandoffPayload = {
    disclaimer:
      "Prepared in Hero Market pre-accounting workspace. Not a filed return. Requires licensed tax professional review.",
    generatedAt: new Date().toISOString(),
    profileSummary,
    readiness: readinessPayload,
    documents: docRows.map((d) => ({
      id: d.id,
      name: d.documentName,
      tag: d.documentTag,
      status: d.status,
      fileUrl: d.fileUrl,
      quarterLabel: d.quarterLabel,
      reportType: d.reportType,
      linkedFormCodes: safeParseStringArray(d.linkedFormCodesJson),
      includeInHandoff: d.includeInHandoff,
      includedInZip: zipIds.includes(d.id),
      ledgerContext: safeParseJson(d.ledgerContextJson),
    })),
    probableForms: composition.includeProbableForms ? probableFormsPayload : null,
    quarterlyBreakdown,
    unresolvedLedgerSummary:
      composition.includeUnresolvedLedgerSummary || composition.includeUnresolvedQuestions
        ? unresolvedLedgerSummary
        : null,
  };

  const { bundleUrl } = await buildAndStoreHandoffZip({
    userId,
    profileId,
    handoffId: handoff.id,
    payload,
    zipDocumentIds: zipIds,
  });

  return { handoffId: handoff.id, bundleUrl };
}

function safeParseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function safeParseNumberArray(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
