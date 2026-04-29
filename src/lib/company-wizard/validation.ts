// Validation helpers for Parent Company + C-Corp Wizard
// Based on the comprehensive blueprint

import { WizardStep, ParentCorpDraft, ValidationResult, ValidationIssue, ParentCorpModule, USState } from "./types";

function hasModule(d: ParentCorpDraft, m: ParentCorpModule): boolean {
  return (d.selectedModules ?? []).includes(m);
}

function pctOk(n: number | null): boolean {
  return n === null || (Number.isFinite(n) && n >= 0 && n <= 100);
}

export function validateStep(step: WizardStep, d: ParentCorpDraft): ValidationResult {
  const issues: ValidationIssue[] = [];
  const req = (field: keyof ParentCorpDraft, msg: string) => {
    const v: any = d[field];
    const empty = v === null || v === undefined || (typeof v === "string" && v.trim().length === 0);
    if (empty) issues.push({ field: String(field), message: msg, severity: "error" });
  };

  if (step === "setup") {
    req("companyName", "Company name is required.");
    if (!d.formationState) issues.push({ field: "formationState", message: "State of formation is required.", severity: "error" });
    if (d.corpType !== "c_corp") {
      issues.push({ field: "corpType", message: "This wizard is optimized for C-Corps. Other forms may require different documents.", severity: "warning" });
    }
  }

  if (step === "onboarding") {
    if (!d.selectedModules || d.selectedModules.length === 0) {
      issues.push({ field: "selectedModules", message: "Select at least one module.", severity: "error" });
    }
  }

  if (step === "formation" && hasModule(d, "formation")) {
    if ((d.authorizedShares ?? 0) <= 0) issues.push({ field: "authorizedShares", message: "Authorized shares must be greater than 0.", severity: "error" });
    if ((d.parValue ?? 0) < 0) issues.push({ field: "parValue", message: "Par value cannot be negative.", severity: "error" });
  }

  if (step === "governance" && hasModule(d, "governance")) {
    if ((d.boardSize ?? 0) <= 0) issues.push({ field: "boardSize", message: "Board size must be at least 1.", severity: "error" });
  }

  if (step === "equity" && hasModule(d, "equity")) {
    if (!d.founders?.length) issues.push({ field: "founders", message: "At least one founder should be listed.", severity: "error" });

    // Cap table sanity checks
    const totalEquity = d.founders.reduce((sum, f) => sum + (f.equityPct || 0), 0);
    if (totalEquity > 100) {
      issues.push({ field: "founders", message: `Total founder equity (${totalEquity}%) exceeds 100%.`, severity: "error" });
    } else if (totalEquity < 90 && d.founders.length > 1) {
      issues.push({ field: "founders", message: `Total founder equity (${totalEquity}%) seems low for ${d.founders.length} founders. Consider reserving more equity.`, severity: "warning" });
    }

    if (d.optionPoolPlanned) {
      if (!pctOk(d.optionPoolPct)) {
        issues.push({ field: "optionPoolPct", message: "Option pool % must be between 0 and 100.", severity: "error" });
      } else if ((d.optionPoolPct || 0) > 20) {
        issues.push({ field: "optionPoolPct", message: "Option pool over 20% is unusually high. Consider standard ranges (5-15%).", severity: "warning" });
      }
    }

    // Authorized shares buffer check
    const totalReserved = totalEquity + (d.optionPoolPct || 0);
    if (d.authorizedShares && d.authorizedShares < totalReserved * 10000) {
      issues.push({ field: "authorizedShares", message: "Authorized shares may be insufficient for planned equity distribution.", severity: "warning" });
    }
  }

  if (step === "banking" && hasModule(d, "banking")) {
    if (d.signatoryRule === "two_signers_over_threshold" && (d.twoSignerThresholdUSD ?? 0) <= 0) {
      issues.push({ field: "twoSignerThresholdUSD", message: "Threshold must be a positive number.", severity: "error" });
    }
  }

  const ok = issues.filter(i => i.severity === "error").length === 0;
  return { ok, issues };
}
