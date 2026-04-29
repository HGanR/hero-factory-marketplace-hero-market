import type {
  FilerEntityType,
  HandoffComposition,
  PreAccountingProfile,
  QuarterlyId,
  QuarterlyPeriodState,
} from "../types";
import { defaultHandoffComposition } from "../types";
import type { accountingProfiles } from "@/lib/db/schema.pre-accounting";
import type { InferSelectModel } from "drizzle-orm";

export type AccountingProfileRow = InferSelectModel<typeof accountingProfiles>;

const QUARTERS: QuarterlyId[] = ["Q1", "Q2", "Q3", "Q4"];

function defaultQuarterly(): Record<QuarterlyId, QuarterlyPeriodState> {
  return {
    Q1: { quarter: "Q1", statementsUploaded: false, reconciled: false, estimatedTaxLogged: false, notes: "" },
    Q2: { quarter: "Q2", statementsUploaded: false, reconciled: false, estimatedTaxLogged: false, notes: "" },
    Q3: { quarter: "Q3", statementsUploaded: false, reconciled: false, estimatedTaxLogged: false, notes: "" },
    Q4: { quarter: "Q4", statementsUploaded: false, reconciled: false, estimatedTaxLogged: false, notes: "" },
  };
}

type ExtendedFacts = Partial<{
  hasEmployees: boolean | null;
  hasBankAccounts: boolean | null;
  hasCreditCards: boolean | null;
  hasPaymentProcessors: boolean | null;
  hasPayrollService: boolean | null;
  hasLoans: boolean | null;
  tracksMileage: boolean | null;
  hasHomeOffice: boolean | null;
  filedQuarterlyEstimates: boolean | null;
  filedPayrollReturns: boolean | null;
}>;

export function rowToPreAccountingProfile(row: AccountingProfileRow): PreAccountingProfile {
  let quarterly: Record<QuarterlyId, QuarterlyPeriodState> = defaultQuarterly();
  try {
    if (row.quarterStatesJson) {
      const p = JSON.parse(row.quarterStatesJson) as Record<string, QuarterlyPeriodState>;
      for (const q of QUARTERS) {
        if (p[q]) quarterly[q] = { ...quarterly[q], ...p[q], quarter: q };
      }
    }
  } catch {
    /* keep default */
  }

  let documentsCollectedTags: PreAccountingProfile["documentsCollectedTags"] = [];
  try {
    if (row.documentsTagsJson) {
      documentsCollectedTags = JSON.parse(row.documentsTagsJson);
    }
  } catch {
    documentsCollectedTags = [];
  }

  let ext: ExtendedFacts = {};
  try {
    if (row.extendedFactsJson) ext = JSON.parse(row.extendedFactsJson) as ExtendedFacts;
  } catch {
    ext = {};
  }

  const basis = row.accountingBasis;
  const accountingBasis: PreAccountingProfile["accountingBasis"] =
    basis === "cash" || basis === "accrual" ? basis : "unknown";

  let defaultHandoffComposition: HandoffComposition | undefined;
  try {
    if (row.defaultHandoffCompositionJson) {
      defaultHandoffComposition = JSON.parse(row.defaultHandoffCompositionJson) as HandoffComposition;
    }
  } catch {
    defaultHandoffComposition = undefined;
  }

  return {
    serverProfileId: row.id,
    reviewStatus: row.reviewStatus ?? "draft",
    handoffReadinessOverrideNote: row.handoffReadinessOverrideNote ?? null,
    handoffReadinessOverrideAt:
      row.handoffReadinessOverrideAt instanceof Date
        ? row.handoffReadinessOverrideAt.toISOString()
        : row.handoffReadinessOverrideAt
          ? new Date(String(row.handoffReadinessOverrideAt)).toISOString()
          : null,
    taxYear: row.taxYear,
    filerEntityType: row.entityType as FilerEntityType,
    accountingBasis,
    hasEmployees: ext.hasEmployees ?? null,
    hasContractors: row.hasContractors,
    hasBankAccounts: ext.hasBankAccounts ?? null,
    hasCreditCards: ext.hasCreditCards ?? null,
    hasPaymentProcessors: ext.hasPaymentProcessors ?? null,
    hasPayrollService: ext.hasPayrollService ?? (row.hasPayroll ? true : null),
    hasLoans: ext.hasLoans ?? null,
    tracksMileage: ext.tracksMileage ?? null,
    hasHomeOffice: ext.hasHomeOffice ?? null,
    hasInventory: row.hasInventory,
    filedQuarterlyEstimates: ext.filedQuarterlyEstimates ?? null,
    filedPayrollReturns: ext.filedPayrollReturns ?? null,
    priorYearReturnAvailable: row.priorYearReturnAvailable ? true : null,
    documentsCollectedTags,
    quarterly,
    preparerNotes: row.preparerNotes ?? "",
    internalReviewNotes: row.internalReviewNotes ?? "",
    defaultHandoffComposition,
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : new Date(String(row.updatedAt)).toISOString(),
  };
}

export function preAccountingProfileToRowPatch(
  p: PreAccountingProfile,
  userId: number
): Omit<AccountingProfileRow, "id" | "createdAt" | "updatedAt"> {
  const ext: ExtendedFacts = {
    hasEmployees: p.hasEmployees,
    hasBankAccounts: p.hasBankAccounts,
    hasCreditCards: p.hasCreditCards,
    hasPaymentProcessors: p.hasPaymentProcessors,
    hasPayrollService: p.hasPayrollService,
    hasLoans: p.hasLoans,
    tracksMileage: p.tracksMileage,
    hasHomeOffice: p.hasHomeOffice,
    filedQuarterlyEstimates: p.filedQuarterlyEstimates,
    filedPayrollReturns: p.filedPayrollReturns,
  };

  return {
    userId,
    workspaceId: null,
    taxYear: p.taxYear,
    entityType: p.filerEntityType,
    accountingBasis: p.accountingBasis,
    hasPayroll: p.hasPayrollService === true || p.hasEmployees === true,
    hasContractors: p.hasContractors === true,
    hasInventory: p.hasInventory === true,
    hasFixedAssets: p.hasLoans === true,
    priorYearReturnAvailable: p.priorYearReturnAvailable === true,
    reviewStatus: (() => {
      const allowed = new Set([
        "draft",
        "in_review",
        "ready_for_preparer",
        "needs_followup",
        "finalized_for_handoff",
      ]);
      return p.reviewStatus && allowed.has(p.reviewStatus) ? p.reviewStatus : "draft";
    })(),
    preparerNotes: p.preparerNotes,
    internalReviewNotes: p.internalReviewNotes ?? "",
    defaultHandoffCompositionJson: JSON.stringify(p.defaultHandoffComposition ?? defaultHandoffComposition()),
    quarterStatesJson: JSON.stringify(p.quarterly),
    documentsTagsJson: JSON.stringify(p.documentsCollectedTags),
    extendedFactsJson: JSON.stringify(ext),
    handoffReadinessOverrideNote: p.handoffReadinessOverrideNote ?? null,
    handoffReadinessOverrideAt: p.handoffReadinessOverrideAt ? new Date(p.handoffReadinessOverrideAt) : null,
  };
}
