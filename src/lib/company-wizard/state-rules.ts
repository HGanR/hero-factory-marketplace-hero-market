// State Rules for Parent Company + C-Corp Wizard
// Based on the comprehensive blueprint

import { USState, StateRule } from "./types";

const GENERIC_STATE_RULE: StateRule = {
  state: "DE",
  overview: [
    "This wizard produces Draft/Review corporate governance and formation artifacts. It does not file with the state.",
    "State filing requirements and defaults vary. Counsel review is recommended prior to adoption/external use.",
  ],
  fieldHelp: {
    authorizedShares: { level: "recommended", label: "Common startup default", detail: "A large authorized share count is commonly used to support future issuances." },
    parValue: { level: "recommended", label: "Par value", detail: "Par value is typically set to a very low amount for C-Corps." },
  },
};

const STATE_RULES: Partial<Record<USState, StateRule>> = {
  DE: {
    state: "DE",
    overview: [
      "Delaware is commonly used for C-Corps due to flexible corporate law and market familiarity.",
      "If you operate outside Delaware, foreign qualification and local compliance may apply.",
    ],
    fieldHelp: {
      formationState: { level: "recommended", label: "Market standard", detail: "DE is a common selection for venture-backed and scalable corporate structures." },
      franchiseTaxAwareness: { level: "recommended", label: "Plan for franchise tax", detail: "Maintain awareness of annual franchise tax and reporting obligations." },
    },
  },
  WY: {
    state: "WY",
    overview: [
      "Wyoming is often selected for holding structures and cost sensitivity; confirm suitability for your investors/counterparties.",
      "If operating elsewhere, foreign qualification may apply.",
    ],
    fieldHelp: {
      annualReportPlanned: { level: "recommended", label: "Annual report", detail: "Plan for annual report filings and registered agent maintenance." },
    },
  },
  CA: {
    state: "CA",
    overview: [
      "If you operate in California, counterparties often expect clear officer authority and governance documentation.",
      "Consider additional state registrations depending on operational footprint.",
    ],
    fieldHelp: {
      bankingReady: { level: "recommended", label: "Banking evidence", detail: "Banks often request bylaws, board consent, and officer appointment documentation." },
    },
  },
  TX: {
    state: "TX",
    overview: [
      "Texas offers competitive incorporation fees and business-friendly corporate law.",
      "Maintain clear governance documentation for banking and counterparty relationships.",
    ],
    fieldHelp: {
      registeredAgentPlanned: { level: "required", label: "Required", detail: "Texas requires a registered agent for corporation maintenance." },
    },
  },
  NY: {
    state: "NY",
    overview: [
      "New York offers established corporate law with strong protections for shareholders and directors.",
      "If operating elsewhere, foreign qualification and publication requirements may apply.",
    ],
    fieldHelp: {
      initialBoardConsentPlanned: { level: "recommended", label: "Strongly recommended", detail: "New York counterparties often require clear initial governance documentation." },
    },
  },
};

export function getStateRule(state: USState | ""): StateRule {
  if (!state) return { ...GENERIC_STATE_RULE, state: "DE" };
  return STATE_RULES[state] ?? { ...GENERIC_STATE_RULE, state };
}








