import type { PreAccountingProfile, AccountingReadinessSnapshot, QuarterlyId } from "./types";

const REQUIRED_DOC_TAGS = [
  "bank_statements",
  "credit_card_statements",
  "income_forms",
  "expense_receipts",
] as const;

export function buildMissingDocumentsList(profile: PreAccountingProfile): string[] {
  const missing: string[] = [];
  for (const tag of REQUIRED_DOC_TAGS) {
    if (!profile.documentsCollectedTags.includes(tag)) {
      const label: Record<string, string> = {
        bank_statements: "Bank statements (all accounts for the tax year)",
        credit_card_statements: "Credit card statements",
        income_forms: "Income forms (1099s, W-2s, K-1s as applicable) — confirm with your preparer",
        expense_receipts: "Expense receipts / support for major deductions",
      };
      missing.push(label[tag] ?? tag);
    }
  }
  if (profile.priorYearReturnAvailable === false) {
    missing.push("Prior-year return (if available) — your preparer may want it for basis and comparisons");
  }
  return missing;
}

function quarterStatus(
  profile: PreAccountingProfile,
  q: QuarterlyId
): "not_started" | "in_progress" | "ready" {
  const p = profile.quarterly[q];
  if (p.statementsUploaded && p.reconciled) return "ready";
  if (p.statementsUploaded || p.reconciled || (p.notes?.trim() ?? "").length > 0) return "in_progress";
  return "not_started";
}

export function computeAccountingReadiness(
  profile: PreAccountingProfile,
  ledger: { totalTransactions: number; uncategorizedCount: number }
): AccountingReadinessSnapshot {
  const missingDocumentsChecklist = buildMissingDocumentsList(profile);

  let bookkeepingScore = 0;
  if (profile.accountingBasis !== "unknown") bookkeepingScore += 20;
  if (ledger.totalTransactions > 0) bookkeepingScore += 25;
  if (ledger.uncategorizedCount === 0 && ledger.totalTransactions > 0) bookkeepingScore += 25;
  else if (ledger.uncategorizedCount < Math.max(1, ledger.totalTransactions * 0.2)) bookkeepingScore += 15;
  if (missingDocumentsChecklist.length === 0) bookkeepingScore += 15;
  else if (missingDocumentsChecklist.length <= 2) bookkeepingScore += 8;
  if (profile.hasBankAccounts === true) bookkeepingScore += 5;
  if (profile.priorYearReturnAvailable === true) bookkeepingScore += 5;
  bookkeepingScore = Math.min(100, bookkeepingScore);

  const quarterlyReadiness: Record<QuarterlyId, "not_started" | "in_progress" | "ready"> = {
    Q1: quarterStatus(profile, "Q1"),
    Q2: quarterStatus(profile, "Q2"),
    Q3: quarterStatus(profile, "Q3"),
    Q4: quarterStatus(profile, "Q4"),
  };

  const qReady = (["Q1", "Q2", "Q3", "Q4"] as const).filter((k) => quarterlyReadiness[k] === "ready").length;
  let yearEnd: "not_started" | "in_progress" | "ready" = "not_started";
  if (qReady >= 3 && bookkeepingScore >= 70) yearEnd = "ready";
  else if (qReady >= 1 || ledger.totalTransactions > 0) yearEnd = "in_progress";

  const unresolvedLedgerItems = ledger.uncategorizedCount;

  let handoffReadinessPercent = Math.round(
    bookkeepingScore * 0.45 +
      (qReady / 4) * 35 +
      (missingDocumentsChecklist.length === 0 ? 20 : Math.max(0, 20 - missingDocumentsChecklist.length * 4))
  );
  handoffReadinessPercent = Math.min(100, Math.max(0, handoffReadinessPercent));

  return {
    bookkeepingCompletenessScore: bookkeepingScore,
    missingDocumentsChecklist,
    quarterlyReadiness,
    yearEndReadiness: yearEnd,
    unresolvedLedgerItems,
    handoffReadinessPercent,
  };
}
