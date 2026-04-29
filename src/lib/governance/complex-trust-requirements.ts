/**
 * Complex Trust Resolution Requirements
 * 
 * For Irrevocable Complex Trusts, actions affecting assets, income, authority, or beneficiary interests
 * require a trustee resolution unless a valid standing resolution explicitly covers it.
 */

export type ComplexTrustAction =
  // Asset-Related Actions
  | "FUND_TRUST"
  | "REAL_ESTATE_TRANSFER_IN"
  | "REAL_ESTATE_TRANSFER_OUT"
  | "SALE_PROPERTY"
  | "PURCHASE_REAL_ESTATE"
  | "ASSIGN_LLC_INTEREST"
  | "PURCHASE_SECURITIES_NON_ROUTINE"
  | "SALE_SECURITIES_NON_ROUTINE"
  | "PLEDGE_ASSETS"
  | "LOAN_MADE_BY_TRUST"
  | "LOAN_TAKEN_BY_TRUST"
  // Entity Control Actions
  | "TRUST_BECOMES_MEMBER"
  | "APPOINT_LLC_MANAGER"
  | "REMOVE_LLC_MANAGER"
  | "APPROVE_LLC_OPERATING_AGREEMENT"
  | "CAPITAL_CONTRIBUTION_TO_LLC"
  | "DISTRIBUTION_FROM_LLC"
  | "SALE_LLC_INTEREST"
  | "GUARANTEE_FOR_LLC"
  // Income, Distributions & Accumulations
  | "DISCRETIONARY_DISTRIBUTION"
  | "ACCUMULATE_INCOME"
  | "CHANGE_DISTRIBUTION_POLICY"
  | "EXTRAORDINARY_BENEFICIARY_PAYMENT"
  | "WITHHOLD_DISTRIBUTIONS"
  // Governance & Authority Changes
  | "APPOINT_TRUSTEE"
  | "REMOVE_TRUSTEE"
  | "CO_TRUSTEE_ACTION_RULES"
  | "DELEGATE_TRUSTEE_POWERS"
  | "AMEND_TRUST"
  | "CHANGE_SITUS"
  | "ADOPT_INVESTMENT_POLICY"
  // Tax & Compliance Actions
  | "TAX_CLASSIFICATION_ACKNOWLEDGMENT"
  | "FILING_POSITION_ACKNOWLEDGMENT"
  | "TAX_ELECTION"
  | "ENGAGE_TAX_PROFESSIONAL";

export const COMPLEX_TRUST_REQUIRED_ACTIONS: ComplexTrustAction[] = [
  "FUND_TRUST",
  "REAL_ESTATE_TRANSFER_IN",
  "REAL_ESTATE_TRANSFER_OUT",
  "SALE_PROPERTY",
  "PURCHASE_REAL_ESTATE",
  "ASSIGN_LLC_INTEREST",
  "PURCHASE_SECURITIES_NON_ROUTINE",
  "SALE_SECURITIES_NON_ROUTINE",
  "PLEDGE_ASSETS",
  "LOAN_MADE_BY_TRUST",
  "LOAN_TAKEN_BY_TRUST",
  "TRUST_BECOMES_MEMBER",
  "APPOINT_LLC_MANAGER",
  "REMOVE_LLC_MANAGER",
  "APPROVE_LLC_OPERATING_AGREEMENT",
  "CAPITAL_CONTRIBUTION_TO_LLC",
  "DISTRIBUTION_FROM_LLC",
  "SALE_LLC_INTEREST",
  "GUARANTEE_FOR_LLC",
  "DISCRETIONARY_DISTRIBUTION",
  "ACCUMULATE_INCOME",
  "CHANGE_DISTRIBUTION_POLICY",
  "EXTRAORDINARY_BENEFICIARY_PAYMENT",
  "WITHHOLD_DISTRIBUTIONS",
  "APPOINT_TRUSTEE",
  "REMOVE_TRUSTEE",
  "CO_TRUSTEE_ACTION_RULES",
  "DELEGATE_TRUSTEE_POWERS",
  "AMEND_TRUST",
  "CHANGE_SITUS",
  "ADOPT_INVESTMENT_POLICY",
  "TAX_CLASSIFICATION_ACKNOWLEDGMENT",
  "FILING_POSITION_ACKNOWLEDGMENT",
  "TAX_ELECTION",
  "ENGAGE_TAX_PROFESSIONAL",
];

export interface ResolutionRequirementCheck {
  required: boolean;
  reason?: string;
  standingResolutionId?: string; // If a standing resolution covers this
}

/**
 * Check if an action requires a resolution for a Complex Trust
 */
export function requiresResolutionForComplexTrust(
  action: ComplexTrustAction,
  trustMode: string | null,
  complexTrustMode: boolean
): ResolutionRequirementCheck {
  // Only enforce for Complex Trusts
  if (trustMode !== "complex" && !complexTrustMode) {
    return { required: false };
  }

  // Check if action is in required list
  if (COMPLEX_TRUST_REQUIRED_ACTIONS.includes(action)) {
    return {
      required: true,
      reason: `Complex Trust mode requires a trustee resolution for: ${action}`,
    };
  }

  return { required: false };
}

/**
 * Map action types to resolution types for template selection
 */
export function getResolutionTypeForAction(action: ComplexTrustAction): string {
  const mapping: Record<ComplexTrustAction, string> = {
    DISCRETIONARY_DISTRIBUTION: "DISCRETIONARY_DISTRIBUTION",
    ACCUMULATE_INCOME: "INCOME_ACCUMULATION",
    APPOINT_LLC_MANAGER: "LLC_MANAGER_APPOINTMENT",
    CAPITAL_CONTRIBUTION_TO_LLC: "CAPITAL_CONTRIBUTION",
    // ... add more mappings as needed
  } as Record<ComplexTrustAction, string>;

  return mapping[action] || "OTHER";
}
