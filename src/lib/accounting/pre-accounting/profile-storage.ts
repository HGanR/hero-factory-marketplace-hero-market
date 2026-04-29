import { z } from "zod";
import type {
  DocumentIntakeTag,
  EleanorAccountingSession,
  EleanorAccountingStage,
  FilerEntityType,
  PreAccountingProfile,
  QuarterlyId,
  QuarterlyPeriodState,
} from "./types";

const STORAGE_KEY = "hero_pre_accounting_profile_v1";
const ELEANOR_SESSION_KEY = "hero_eleanor_accounting_session_v1";
const DOCUMENTS_KEY = "hero_accounting_document_library_v1";

const filerEntityTypeSchema = z.enum([
  "individual",
  "sole_prop_schedule_c",
  "single_member_llc",
  "partnership",
  "s_corp",
  "c_corp",
  "trust_estate",
  "nonprofit",
]);

const quarterSchema = z.object({
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  statementsUploaded: z.boolean(),
  reconciled: z.boolean(),
  estimatedTaxLogged: z.boolean(),
  notes: z.string(),
});

const profileSchema = z.object({
  taxYear: z.number().int().min(2000).max(2100),
  filerEntityType: filerEntityTypeSchema,
  accountingBasis: z.enum(["cash", "accrual", "unknown"]),
  hasEmployees: z.boolean().nullable(),
  hasContractors: z.boolean().nullable(),
  hasBankAccounts: z.boolean().nullable(),
  hasCreditCards: z.boolean().nullable(),
  hasPaymentProcessors: z.boolean().nullable(),
  hasPayrollService: z.boolean().nullable(),
  hasLoans: z.boolean().nullable(),
  tracksMileage: z.boolean().nullable(),
  hasHomeOffice: z.boolean().nullable(),
  hasInventory: z.boolean().nullable(),
  filedQuarterlyEstimates: z.boolean().nullable(),
  filedPayrollReturns: z.boolean().nullable(),
  priorYearReturnAvailable: z.boolean().nullable(),
  documentsCollectedTags: z.array(z.string()) as z.ZodType<DocumentIntakeTag[]>,
  quarterly: z.record(z.enum(["Q1", "Q2", "Q3", "Q4"]), quarterSchema),
  preparerNotes: z.string(),
  internalReviewNotes: z.string().optional(),
  defaultHandoffComposition: z.any().optional(),
  updatedAt: z.string(),
  reviewStatus: z.string().optional(),
  serverProfileId: z.number().optional(),
  handoffReadinessOverrideNote: z.string().nullable().optional(),
  handoffReadinessOverrideAt: z.string().nullable().optional(),
});

const eleanorSessionSchema = z.object({
  stage: z.enum([
    "identify_filer",
    "bookkeeping_basis",
    "business_facts",
    "request_records",
    "ledger_review",
    "forms_checklist",
    "packet_handoff",
  ]),
  lastReplyAt: z.string(),
});

const documentItemSchema = z.object({
  id: z.string(),
  tag: z.string(),
  displayName: z.string(),
  addedAt: z.string(),
  note: z.string().optional(),
});

function defaultQuarter(q: QuarterlyId): QuarterlyPeriodState {
  return {
    quarter: q,
    statementsUploaded: false,
    reconciled: false,
    estimatedTaxLogged: false,
    notes: "",
  };
}

export function defaultPreAccountingProfile(): PreAccountingProfile {
  const y = new Date().getFullYear();
  return {
    taxYear: y,
    filerEntityType: "sole_prop_schedule_c",
    accountingBasis: "unknown",
    hasEmployees: null,
    hasContractors: null,
    hasBankAccounts: null,
    hasCreditCards: null,
    hasPaymentProcessors: null,
    hasPayrollService: null,
    hasLoans: null,
    tracksMileage: null,
    hasHomeOffice: null,
    hasInventory: null,
    filedQuarterlyEstimates: null,
    filedPayrollReturns: null,
    priorYearReturnAvailable: null,
    documentsCollectedTags: [],
    quarterly: {
      Q1: defaultQuarter("Q1"),
      Q2: defaultQuarter("Q2"),
      Q3: defaultQuarter("Q3"),
      Q4: defaultQuarter("Q4"),
    },
    preparerNotes: "",
    internalReviewNotes: "",
    updatedAt: new Date().toISOString(),
  };
}

export function loadPreAccountingProfile(): PreAccountingProfile {
  if (typeof window === "undefined") return defaultPreAccountingProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreAccountingProfile();
    const parsed = JSON.parse(raw);
    const r = profileSchema.safeParse(parsed);
    if (!r.success) return defaultPreAccountingProfile();
    return r.data as PreAccountingProfile;
  } catch {
    return defaultPreAccountingProfile();
  }
}

export function savePreAccountingProfile(profile: PreAccountingProfile): void {
  if (typeof window === "undefined") return;
  const next = { ...profile, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function loadEleanorAccountingSession(): EleanorAccountingSession {
  if (typeof window === "undefined") {
    return { stage: "identify_filer", lastReplyAt: new Date().toISOString() };
  }
  try {
    const raw = localStorage.getItem(ELEANOR_SESSION_KEY);
    if (!raw) return { stage: "identify_filer", lastReplyAt: new Date().toISOString() };
    const parsed = JSON.parse(raw);
    const r = eleanorSessionSchema.safeParse(parsed);
    if (!r.success) return { stage: "identify_filer", lastReplyAt: new Date().toISOString() };
    return r.data;
  } catch {
    return { stage: "identify_filer", lastReplyAt: new Date().toISOString() };
  }
}

export function saveEleanorAccountingSession(session: EleanorAccountingSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ELEANOR_SESSION_KEY, JSON.stringify(session));
}

export type DocumentLibraryItemStored = z.infer<typeof documentItemSchema>;

export function loadDocumentLibrary(): DocumentLibraryItemStored[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => documentItemSchema.safeParse(x).success) as DocumentLibraryItemStored[];
  } catch {
    return [];
  }
}

export function saveDocumentLibrary(items: DocumentLibraryItemStored[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(items));
}

export const ACCOUNTING_DATA_STORAGE_KEY = "troothhurtz_accounting_data";

export function readTransactionSnapshotFromLocalStorage(): {
  incomeCount: number;
  expenseCount: number;
  uncategorizedCount: number;
  totalTransactions: number;
} {
  if (typeof window === "undefined") {
    return { incomeCount: 0, expenseCount: 0, uncategorizedCount: 0, totalTransactions: 0 };
  }
  try {
    const raw = localStorage.getItem(ACCOUNTING_DATA_STORAGE_KEY);
    if (!raw) return { incomeCount: 0, expenseCount: 0, uncategorizedCount: 0, totalTransactions: 0 };
    const data = JSON.parse(raw) as { transactions?: Array<{ type: string; category?: string }> };
    const txs = data.transactions ?? [];
    let incomeCount = 0;
    let expenseCount = 0;
    let uncategorizedCount = 0;
    for (const t of txs) {
      if (t.type === "income") incomeCount++;
      else if (t.type === "expense") expenseCount++;
      const cat = (t.category ?? "").trim();
      if (!cat || cat === "Other expenses" || cat === "Miscellaneous") uncategorizedCount++;
    }
    return {
      incomeCount,
      expenseCount,
      uncategorizedCount,
      totalTransactions: txs.length,
    };
  } catch {
    return { incomeCount: 0, expenseCount: 0, uncategorizedCount: 0, totalTransactions: 0 };
  }
}
