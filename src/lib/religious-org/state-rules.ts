// Enhanced State Rules for Religious Organizations
// Based on the comprehensive onboarding blueprint

import { USState, StateRule } from "./types";

const GENERIC_RULE: StateRule = {
  state: "TX",
  overview: [
    "State rules vary. This wizard provides state-aware guidance where available and highlights common banking/counterparty expectations.",
    "Consult qualified counsel for jurisdiction-specific legal interpretation and adoption/execution formalities.",
  ],
  constraints: { minGoverningBodySize: null, quorumFloorPct: null },
  fieldHelp: {
    orgForm: {
      level: "recommended",
      label: "Incorporation often helpful",
      detail: "Incorporation is commonly used for liability containment and for smoother banking/contracting.",
      sourceHint: "Common practice",
    },
  },
  bylawsHelp: {
    quorum: {
      level: "recommended",
      label: "Set a quorum",
      detail: "Choose a quorum appropriate to expected attendance; avoid ultra-low thresholds that weaken governance credibility.",
      sourceHint: "Governance practice",
    },
    dissolution: {
      level: "recommended",
      label: "Dissolution clause",
      detail: "Recommended to clarify asset disposition consistent with religious/charitable purposes.",
      sourceHint: "Operational readiness",
    },
    conflictPolicy: {
      level: "recommended",
      label: "Conflict policy",
      detail: "Strongly recommended as a governance and risk-management best practice.",
      sourceHint: "Compliance practice",
    },
    memberStructure: {
      level: "optional",
      label: "Member structure",
      detail: "Use statutory members only if your governance model requires it; board-governed is typical.",
      sourceHint: "Entity design",
    },
  },
};

export const RELIGIOUS_ORG_STATE_RULES: Partial<Record<USState, StateRule>> = {
  TX: {
    state: "TX",
    overview: [
      "Texas formation commonly supports nonprofit corporate structures for churches seeking banking and contracting readiness.",
      "Maintain clear officer authority and minutes for governance legitimacy with banks and counterparties.",
    ],
    constraints: { minGoverningBodySize: 3, quorumFloorPct: 10 },
    fieldHelp: {
      directorsOrTrusteesCount: {
        level: "recommended",
        label: "Governance baseline",
        detail: "For corporate governance, a governing body of at least 3 is commonly expected for legitimacy.",
        sourceHint: "Operational readiness",
      },
    },
    bylawsHelp: {
      ...GENERIC_RULE.bylawsHelp,
      quorum: {
        level: "recommended",
        label: "Quorum guidance",
        detail: "Set quorum to support decisions while maintaining governance integrity. Avoid extreme lows.",
        sourceHint: "Governance practice",
      },
    },
  },
  DE: {
    state: "DE",
    overview: [
      "Delaware is frequently used for flexible internal governance. If operating outside Delaware, foreign qualification and local compliance may apply.",
      "Optimize governance documents for counterparties and banking readiness regardless of formation state.",
    ],
    constraints: { minGoverningBodySize: 1, quorumFloorPct: null },
    fieldHelp: {
      formationState: {
        level: "recommended",
        label: "Operating footprint",
        detail: "If you form in Delaware but operate elsewhere, ensure local registrations and compliance are addressed.",
        sourceHint: "Operational compliance",
      },
    },
    bylawsHelp: { ...GENERIC_RULE.bylawsHelp },
  },
  CA: {
    state: "CA",
    overview: [
      "California has distinct nonprofit classifications and common counterparty expectations for documented governance authority.",
      "Maintain clear governance documents, minutes, and signatory authority to reduce banking friction.",
    ],
    constraints: { minGoverningBodySize: 1, quorumFloorPct: null },
    fieldHelp: {
      recordkeepingPlan: {
        level: "recommended",
        label: "Records discipline",
        detail: "Banks and counterparties frequently request governance evidence. Keep minutes and key policies current.",
        sourceHint: "Operational readiness",
      },
    },
    bylawsHelp: { ...GENERIC_RULE.bylawsHelp },
  },
};

export function getStateRule(state: USState | ""): StateRule {
  if (!state) return { ...GENERIC_RULE, state: "TX" };
  return RELIGIOUS_ORG_STATE_RULES[state] ?? { ...GENERIC_RULE, state };
}
