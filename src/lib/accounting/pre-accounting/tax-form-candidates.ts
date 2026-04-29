import type { PreAccountingProfile, TaxFormCandidate, FormReadinessStatus } from "./types";

export function computeTaxFormCandidates(
  profile: PreAccountingProfile,
  ledger: { totalTransactions: number; uncategorizedCount: number }
): TaxFormCandidate[] {
  const t = profile.filerEntityType;
  const hasTx = ledger.totalTransactions > 0;
  const messy = ledger.uncategorizedCount > 0;

  const defaultStatus = (): FormReadinessStatus => {
    if (messy) return "needs_professional_review";
    if (!hasTx) return "missing_support";
    return "partial";
  };

  const candidates: TaxFormCandidate[] = [];

  const add = (c: Omit<TaxFormCandidate, "status"> & { status?: FormReadinessStatus }) => {
    candidates.push({
      ...c,
      status: c.status ?? defaultStatus(),
    });
  };

  if (t === "individual" || t === "sole_prop_schedule_c" || t === "single_member_llc") {
    add({
      id: "1040",
      name: "Form 1040 (U.S. Individual Income Tax Return)",
      whyMayApply: "A tax preparer will typically use Form 1040 for individual filers; business income may flow through schedules.",
      usualRecords: "W-2s, 1099s, prior-year return, bank summaries, supporting receipts for itemized deductions if applicable.",
      dateRangesOrThresholds: "Calendar tax year; many items depend on filing status and thresholds.",
      status: messy ? "needs_professional_review" : hasTx ? "partial" : "missing_support",
    });
    add({
      id: "schedule_c",
      name: "Schedule C (Profit or Loss From Business)",
      whyMayApply: "You may need Schedule C if you report business income or sole proprietor activity — **confirm with your licensed tax professional**.",
      usualRecords: "Income and expense detail, 1099-NEC/MISC, receipts, mileage logs, COGS support.",
      dateRangesOrThresholds: "Generally follows business books for the tax year.",
      status: t === "sole_prop_schedule_c" || t === "single_member_llc" ? "partial" : "missing_support",
    });
    add({
      id: "schedule_se",
      name: "Schedule SE (Self-Employment Tax)",
      whyMayApply: "Often relevant when net self-employment income exists — **your preparer determines applicability**.",
      usualRecords: "Schedule C net earnings or farm/other self-employment earnings.",
      dateRangesOrThresholds: "Based on net earnings from self-employment.",
    });
  }

  if (t === "partnership") {
    add({
      id: "1065",
      name: "Form 1065 (U.S. Return of Partnership Income)",
      whyMayApply: "Partnerships commonly file Form 1065; **final determination is your preparer’s**.",
      usualRecords: "Partnership books, K-1 drafts, capital accounts, debt schedules.",
      dateRangesOrThresholds: "Tax year; partnership agreement governs allocations.",
    });
    add({
      id: "k1",
      name: "Schedule K-1 (Partner’s Share)",
      whyMayApply: "Partners usually receive K-1s for income and deductions — **confirm timing with your preparer**.",
      usualRecords: "1065 outputs, partner basis tracking.",
      dateRangesOrThresholds: "Issued after partnership return preparation.",
    });
  }

  if (t === "s_corp") {
    add({
      id: "1120s",
      name: "Form 1120-S (U.S. Income Tax Return for an S Corporation)",
      whyMayApply: "S-corps often use Form 1120-S — **a licensed professional must confirm**.",
      usualRecords: "Payroll, shareholder wages, basis, financial statements, K-1 support.",
      dateRangesOrThresholds: "Tax year; reasonable compensation rules may apply.",
    });
  }

  if (t === "c_corp") {
    add({
      id: "1120",
      name: "Form 1120 (U.S. Corporation Income Tax Return)",
      whyMayApply: "C-corps commonly use Form 1120 — **confirm with your preparer**.",
      usualRecords: "Books, financial statements, payroll, depreciation schedules.",
      dateRangesOrThresholds: "Tax year.",
    });
  }

  if (t === "trust_estate") {
    add({
      id: "1041",
      name: "Form 1041 (U.S. Income Tax Return for Estates and Trusts)",
      whyMayApply: "May apply to trusts and estates — **highly fact-specific**; preparer review required.",
      usualRecords: "Trust instrument, accounting records, income distributions, beneficiary statements.",
      dateRangesOrThresholds: "Fiscal or calendar year per trust terms.",
    });
  }

  if (t === "nonprofit") {
    add({
      id: "990",
      name: "Form 990 (Return of Organization Exempt From Income Tax)",
      whyMayApply: "Many tax-exempt organizations file Form 990 — **your preparer confirms** filing obligation.",
      usualRecords: "Governance, program/service detail, financial statements, schedules as applicable.",
      dateRangesOrThresholds: "Tax year; public inspection rules may apply to the return.",
    });
  }

  if (profile.hasEmployees === true) {
    add({
      id: "941",
      name: "Form 941 (Employer’s Quarterly Federal Tax Return)",
      whyMayApply: "Employers often file quarterly payroll — **your payroll provider or preparer confirms**.",
      usualRecords: "Payroll registers, tax deposits, W-2/W-3 support.",
      dateRangesOrThresholds: "Quarterly due dates.",
    });
    add({
      id: "940",
      name: "Form 940 (Federal Unemployment Tax)",
      whyMayApply: "May apply if you pay wages — **confirm with your preparer**.",
      usualRecords: "Payroll summaries, state unemployment records.",
      dateRangesOrThresholds: "Annual filing commonly.",
    });
  }

  if (profile.hasContractors === true) {
    add({
      id: "1099_nec",
      name: "Form 1099-NEC / 1099-MISC",
      whyMayApply: "Information returns may be required for certain payments — **thresholds and rules change; preparer confirms**.",
      usualRecords: "Vendor ledger, contractor W-9s, payment totals.",
      dateRangesOrThresholds: "Calendar year payment totals; due dates for filing and recipient copies.",
    });
  }

  const hasAssets = profile.hasLoans === true || profile.hasInventory === true;
  if (hasAssets) {
    add({
      id: "4562",
      name: "Form 4562 (Depreciation and Amortization)",
      whyMayApply: "Often relevant when fixed assets exist — **your preparer determines**.",
      usualRecords: "Asset purchase records, placed-in-service dates, prior depreciation.",
      dateRangesOrThresholds: "Asset life and convention per tax rules.",
    });
  }

  if (profile.hasHomeOffice === true) {
    add({
      id: "8829",
      name: "Form 8829 (Expenses for Business Use of Your Home)",
      whyMayApply: "May apply to home office deductions — **strict rules apply**; preparer must review.",
      usualRecords: "Square footage, utilities, rent/mortgage allocable support.",
      dateRangesOrThresholds: "Regular and exclusive use tests — **professional determination**.",
    });
  }

  return candidates;
}
