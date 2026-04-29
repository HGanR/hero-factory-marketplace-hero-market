/**
 * Trust Decision Tree – Logic map for trust type selection.
 * Use this to guide users toward appropriate trust structures based on objectives.
 * Not legal advice; encourage professional consultation.
 */

export type TrustObjective =
  | "probate_avoidance"
  | "asset_protection"
  | "estate_tax_planning"
  | "medicaid_planning"
  | "business_succession"
  | "dynasty_wealth"
  | "income_splitting"
  | "incapacity_planning"
  | "creditor_protection_beneficiary";

export type TrustType =
  | "revocable"
  | "irrevocable_grantor"
  | "irrevocable_non_grantor"
  | "spendthrift"
  | "dynasty"
  | "IDGT"
  | "SLAT"
  | "DAPT"
  | "directed";

export interface TrustRecommendation {
  trustType: TrustType;
  label: string;
  fitScore: 1 | 2 | 3;
  briefReason: string;
  considerations: string[];
  jurisdictionalNote?: string;
}

export interface DecisionNode {
  objective: TrustObjective;
  label: string;
  keywords: string[];
  recommendations: TrustRecommendation[];
}

const DECISION_TREE: DecisionNode[] = [
  {
    objective: "probate_avoidance",
    label: "Probate avoidance",
    keywords: ["probate", "avoid probate", "without probate", "administration", "death", "when i die", "after death"],
    recommendations: [
      {
        trustType: "revocable",
        label: "Revocable Living Trust",
        fitScore: 1,
        briefReason: "Primary tool for probate avoidance while retaining control.",
        considerations: ["No asset protection", "Income taxed to grantor", "Must fund the trust"],
      },
    ],
  },
  {
    objective: "incapacity_planning",
    label: "Incapacity planning",
    keywords: ["incapacity", "durable power", "guardian", "if i cant", "unable to manage"],
    recommendations: [
      {
        trustType: "revocable",
        label: "Revocable Living Trust",
        fitScore: 1,
        briefReason: "Successor trustee can manage without court involvement.",
        considerations: ["Must appoint successor trustee", "Fund trust during lifetime"],
      },
    ],
  },
  {
    objective: "asset_protection",
    label: "Asset protection",
    keywords: ["asset protection", "creditor", "lawsuit", "shield assets", "protect from", "protect my assets", "creditor protection", "lawsuit protection"],
    recommendations: [
      {
        trustType: "DAPT",
        label: "Domestic Asset Protection Trust (DAPT)",
        fitScore: 1,
        briefReason: "Some states allow self-settled asset protection trusts.",
        considerations: [
          "Only available in certain states (NV, SD, WY, etc.)",
          "Fraudulent transfer rules apply",
          "Statutory waiting period before protection",
        ],
        jurisdictionalNote: "State-specific; not all states recognize DAPTs.",
      },
      {
        trustType: "irrevocable_non_grantor",
        label: "Irrevocable Non-Grantor Trust",
        fitScore: 2,
        briefReason: "Grantor relinquishes control; assets outside reach.",
        considerations: ["Loss of control", "Must be formed before claim arises", "Fraudulent transfer risk if timing is wrong"],
      },
    ],
  },
  {
    objective: "creditor_protection_beneficiary",
    label: "Creditor protection for beneficiaries",
    keywords: ["spendthrift", "beneficiary creditor", "protect beneficiary"],
    recommendations: [
      {
        trustType: "spendthrift",
        label: "Trust with spendthrift provision",
        fitScore: 1,
        briefReason: "Restricts beneficiary's ability to assign interest; limits creditor attachment.",
        considerations: ["State law varies", "Some claims may pierce (e.g., child support, IRS)"],
      },
    ],
  },
  {
    objective: "estate_tax_planning",
    label: "Estate tax reduction",
    keywords: ["estate tax", "exclusion", "unified credit", "taxable estate", "reduce estate tax", "estate tax planning", "minimize estate tax"],
    recommendations: [
      {
        trustType: "SLAT",
        label: "Spousal Lifetime Access Trust (SLAT)",
        fitScore: 1,
        briefReason: "Removes assets from estate while spouse retains indirect access.",
        considerations: ["Divorce risk", "Coordinating with spouse's trust"],
      },
      {
        trustType: "IDGT",
        label: "Intentionally Defective Grantor Trust (IDGT)",
        fitScore: 1,
        briefReason: "Estate freeze; appreciation outside estate; grantor pays income tax.",
        considerations: ["Complex", "Grantor bears income tax burden"],
      },
      {
        trustType: "irrevocable_grantor",
        label: "Irrevocable Grantor Trust",
        fitScore: 2,
        briefReason: "Assets out of estate; grantor pays income tax.",
        considerations: ["Grantor must have liquidity for income tax"],
      },
    ],
  },
  {
    objective: "medicaid_planning",
    label: "Medicaid qualification",
    keywords: ["medicaid", "nursing home", "long-term care", "eligibility", "qualify for medicaid", "nursing home costs"],
    recommendations: [
      {
        trustType: "irrevocable_non_grantor",
        label: "Irrevocable Medicaid Qualifying Trust",
        fitScore: 1,
        briefReason: "Assets transferred outside 5-year lookback; income/principal rules apply.",
        considerations: [
          "5-year lookback rule",
          "Medicaid rules vary by state",
          "Must not retain prohibited powers",
        ],
        jurisdictionalNote: "State Medicaid rules differ; consult elder law attorney.",
      },
    ],
  },
  {
    objective: "business_succession",
    label: "Business succession",
    keywords: ["business succession", "company", "ownership", "family business", "transition"],
    recommendations: [
      {
        trustType: "irrevocable_grantor",
        label: "Irrevocable Trust (Grantor or Non-Grantor)",
        fitScore: 1,
        briefReason: "Holds business interests; facilitates transfer to next generation.",
        considerations: ["Valuation", "Operating agreements", "Directed trust for active management"],
      },
      {
        trustType: "directed",
        label: "Directed Trust",
        fitScore: 2,
        briefReason: "Administrative trustee + investment advisor; separates control from administration.",
        considerations: ["State law (DE, SD, NV favorable)", "Advisor selection"],
      },
    ],
  },
  {
    objective: "dynasty_wealth",
    label: "Multi-generation wealth transfer",
    keywords: ["dynasty", "generation", "grandchildren", "multi-gen", "GSTT", "generation skipping", "leave to grandchildren"],
    recommendations: [
      {
        trustType: "dynasty",
        label: "Dynasty Trust",
        fitScore: 1,
        briefReason: "Uses GST exemption; assets can persist across generations.",
        considerations: ["GST tax rules", "State rule against perpetuities", "Situs selection"],
      },
    ],
  },
  {
    objective: "income_splitting",
    label: "Income splitting / state tax arbitrage",
    keywords: ["income split", "state tax", "NRA", "nonresident"],
    recommendations: [
      {
        trustType: "irrevocable_non_grantor",
        label: "Non-Grantor Trust (NRA grantor or situs planning)",
        fitScore: 1,
        briefReason: "Trust as separate taxpayer; state situs can affect taxation.",
        considerations: ["IRC 643", "State nexus rules", "NRA grantor complexity"],
        jurisdictionalNote: "State and federal rules apply; structure must be compliant.",
      },
    ],
  },
];

/** Match user message to trust objectives and return applicable recommendations. */
export function matchTrustObjectives(message: string): DecisionNode[] {
  const lower = message.toLowerCase().trim();
  return DECISION_TREE.filter((node) =>
    node.keywords.some((k) => lower.includes(k.toLowerCase()))
  );
}

/** Get a human-readable summary of the decision tree output. */
export function formatDecisionTreeOutput(nodes: DecisionNode[]): string {
  if (nodes.length === 0) return "";

  const parts: string[] = [];
  for (const node of nodes) {
    parts.push(`**${node.label}**\n`);
    for (const rec of node.recommendations) {
      parts.push(`• ${rec.label}: ${rec.briefReason}`);
      if (rec.jurisdictionalNote) parts.push(`  (${rec.jurisdictionalNote})`);
      parts.push(`  Considerations: ${rec.considerations.join("; ")}`);
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}
