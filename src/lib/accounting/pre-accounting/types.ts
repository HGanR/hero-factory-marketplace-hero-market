/**
 * Pre-accounting / tax-prep support types — records preparation for licensed professionals only.
 * Not tax advice; not a filing engine.
 */

export type FilerEntityType =
  | "individual"
  | "sole_prop_schedule_c"
  | "single_member_llc"
  | "partnership"
  | "s_corp"
  | "c_corp"
  | "trust_estate"
  | "nonprofit";

export type EleanorAccountingStage =
  | "identify_filer"
  | "bookkeeping_basis"
  | "business_facts"
  | "request_records"
  | "ledger_review"
  | "forms_checklist"
  | "packet_handoff";

export type DocumentIntakeTag =
  | "bank_statements"
  | "credit_card_statements"
  | "merchant_processor"
  | "payroll_reports"
  | "contractor_forms"
  | "income_forms"
  | "expense_receipts"
  | "loan_documents"
  | "asset_purchases"
  | "prior_year_returns"
  | "estimated_tax_payments"
  | "state_filings"
  | "irs_notices"
  | "entity_formation"
  | "trust_docs"
  | "other";

export type QuarterlyId = "Q1" | "Q2" | "Q3" | "Q4";

export interface QuarterlyPeriodState {
  quarter: QuarterlyId;
  statementsUploaded: boolean;
  reconciled: boolean;
  estimatedTaxLogged: boolean;
  notes: string;
}

/** Server-backed defaults for what sections/files a handoff ZIP and JSON include. */
export type HandoffComposition = {
  /** If null, all documents with includeInHandoff and not in excludeDocumentIds are included */
  includeDocumentIds: number[] | null;
  excludeDocumentIds: number[];
  includeProbableForms: boolean;
  includeUnresolvedQuestions: boolean;
  includeUnresolvedLedgerSummary: boolean;
  includePreparerNotes: boolean;
  includeReadinessSummary: boolean;
  includeQuarterBreakdown: boolean;
  /** Profile/document internal reviewer notes — off by default in client-facing artifacts */
  includeInternalReviewerNotes: boolean;
};

export function defaultHandoffComposition(): HandoffComposition {
  return {
    includeDocumentIds: null,
    excludeDocumentIds: [],
    includeProbableForms: true,
    includeUnresolvedQuestions: true,
    includeUnresolvedLedgerSummary: true,
    includePreparerNotes: true,
    includeReadinessSummary: true,
    includeQuarterBreakdown: true,
    includeInternalReviewerNotes: false,
  };
}

export interface PreAccountingProfile {
  taxYear: number;
  filerEntityType: FilerEntityType;
  accountingBasis: "cash" | "accrual" | "unknown";
  hasEmployees: boolean | null;
  hasContractors: boolean | null;
  hasBankAccounts: boolean | null;
  hasCreditCards: boolean | null;
  hasPaymentProcessors: boolean | null;
  hasPayrollService: boolean | null;
  hasLoans: boolean | null;
  tracksMileage: boolean | null;
  hasHomeOffice: boolean | null;
  hasInventory: boolean | null;
  filedQuarterlyEstimates: boolean | null;
  filedPayrollReturns: boolean | null;
  priorYearReturnAvailable: boolean | null;
  /** Document tags user marked as collected */
  documentsCollectedTags: DocumentIntakeTag[];
  quarterly: Record<QuarterlyId, QuarterlyPeriodState>;
  /** Client-facing / preparer-visible notes (may appear in handoff when enabled) */
  preparerNotes: string;
  /** Internal reviewer-only — excluded from exports unless explicitly included */
  internalReviewNotes?: string;
  /** Persisted server default for handoff generator (optional local cache) */
  defaultHandoffComposition?: HandoffComposition;
  updatedAt: string;
  /** Server-backed profile row id when synced */
  serverProfileId?: number;
  /** Server review workflow: draft | in_review | ready_for_preparer | needs_followup | finalized_for_handoff */
  reviewStatus?: string;
  /** Set when reviewer acknowledges readiness gate while blockers remain (server-persisted). */
  handoffReadinessOverrideNote?: string | null;
  handoffReadinessOverrideAt?: string | null;
}

export interface DocumentLibraryItem {
  id: string;
  tag: DocumentIntakeTag;
  displayName: string;
  addedAt: string;
  /** Optional note only — no server upload in v1 */
  note?: string;
}

export type FormReadinessStatus = "ready" | "partial" | "missing_support" | "needs_professional_review";

export interface TaxFormCandidate {
  id: string;
  name: string;
  whyMayApply: string;
  usualRecords: string;
  dateRangesOrThresholds: string;
  status: FormReadinessStatus;
}

export interface EleanorAccountingSession {
  stage: EleanorAccountingStage;
  lastReplyAt: string;
}

export interface AccountingReadinessSnapshot {
  bookkeepingCompletenessScore: number;
  missingDocumentsChecklist: string[];
  quarterlyReadiness: Record<QuarterlyId, "not_started" | "in_progress" | "ready">;
  yearEndReadiness: "not_started" | "in_progress" | "ready";
  unresolvedLedgerItems: number;
  handoffReadinessPercent: number;
}

export interface TransactionSnapshot {
  incomeCount: number;
  expenseCount: number;
  uncategorizedCount: number;
  totalTransactions: number;
}
