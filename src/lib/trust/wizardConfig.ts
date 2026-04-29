import type { TrustMode } from "./types";

export type WizardStepId =
  | "overview"
  | "parties"
  | "assets"
  | "state_helper"
  | "tax_ein"          // should be blocked in private_safe
  | "filings"          // should be blocked in private_safe
  | "documents"
  | "review";

export function getWizardSteps(trustMode: TrustMode): WizardStepId[] {
  const base: WizardStepId[] = [
    "overview",
    "parties",
    "assets",
    "state_helper",
    "documents",
    "review",
  ];

  if (trustMode === "private_safe") {
    // explicitly exclude anything that implies state creation/registration
    return base;
  }

  // standard mode can include optional tax/filings assistance
  return [
    "overview",
    "parties",
    "assets",
    "state_helper",
    "tax_ein",
    "filings",
    "documents",
    "review",
  ];
}

export function isStepAllowed(step: WizardStepId, trustMode: TrustMode): boolean {
  return getWizardSteps(trustMode).includes(step);
}




