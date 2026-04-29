/** Structured buyer intake for MAANIA buy path — state-driven snapshot + demo handoff. */

export type BuyerIntentPath = "buy";

export type BuyerFinancingType = "preapproved" | "cash" | "needs_lender" | "unknown";

export type BuyerPropertyType =
  | "single_family"
  | "condo"
  | "townhome"
  | "multi_family"
  | "land"
  | "commercial"
  | "other"
  | "unknown";

export interface BuyerDraft {
  financing: BuyerFinancingType;
  budgetMin: number | null;
  budgetMax: number | null;
  monthlyPaymentTarget: number | null;

  targetAreas: string[];
  propertyType: BuyerPropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  sqftMin: number | null;
  sqftMax: number | null;

  moveInReadyPreference: "move_in_ready" | "open_to_work" | "unknown";
  mustHaves: string[];
  dealBreakers: string[];

  timeline: string;
  currentHousingSituation: string;
  mustSellFirst: boolean | null;

  offerCompetitionComfort: "low" | "medium" | "high" | "unknown";
  repairTolerance: "low" | "medium" | "high" | "unknown";
  offMarketInterest: boolean | null;

  experienceLevel: "first_time" | "repeat" | "investor" | "unknown";
  referralNeeds: string[];

  decisionMakers: string;
  primaryDecisionFactor: "price" | "location" | "condition" | "long_term_value" | "unknown";
  reasonForBuyingNow: string;

  knownTitleIssues: boolean | null;
  knownLienIssues: boolean | null;
  knownMortgageComplications: boolean | null;
  jurisdiction: string;

  wantsClientSummary: boolean | null;
  wantsAdvisorSummary: boolean | null;
}

export function createInitialBuyerDraft(): BuyerDraft {
  return {
    financing: "unknown",
    budgetMin: null,
    budgetMax: null,
    monthlyPaymentTarget: null,
    targetAreas: [],
    propertyType: "unknown",
    bedrooms: null,
    bathrooms: null,
    sqftMin: null,
    sqftMax: null,
    moveInReadyPreference: "unknown",
    mustHaves: [],
    dealBreakers: [],
    timeline: "",
    currentHousingSituation: "",
    mustSellFirst: null,
    offerCompetitionComfort: "unknown",
    repairTolerance: "unknown",
    offMarketInterest: null,
    experienceLevel: "unknown",
    referralNeeds: [],
    decisionMakers: "",
    primaryDecisionFactor: "unknown",
    reasonForBuyingNow: "",
    knownTitleIssues: null,
    knownLienIssues: null,
    knownMortgageComplications: null,
    jurisdiction: "",
    wantsClientSummary: null,
    wantsAdvisorSummary: null,
  };
}
