import type { BuyerDraft } from "@/lib/maania/buyer-draft";

export type BuyerFlowStep = {
  id: string;
  question: string;
  isAnswered: (d: BuyerDraft) => boolean;
};

function hasBudgetSignal(d: BuyerDraft): boolean {
  return (
    d.budgetMin != null ||
    d.budgetMax != null ||
    d.monthlyPaymentTarget != null
  );
}

function hasLayoutSignal(d: BuyerDraft): boolean {
  return (
    d.bedrooms != null ||
    d.bathrooms != null ||
    d.sqftMin != null ||
    d.sqftMax != null
  );
}

function hasMustHavesOrDealbreakers(d: BuyerDraft): boolean {
  return d.mustHaves.length > 0 || d.dealBreakers.length > 0;
}

/**
 * Priority-ordered steps — first unanswered wins for next question.
 * Aligns with product priority: finance → budget → location → home type → layout → preferences → timeline → people → motivation → risk/advanced.
 */
export const BUYER_INTAKE_STEPS: BuyerFlowStep[] = [
  {
    id: "financing",
    question: "Are you already pre-approved for a mortgage, or will this be a cash purchase?",
    isAnswered: (d) => d.financing !== "unknown",
  },
  {
    id: "budget",
    question: "What price range are you most comfortable with? (If easier, share a monthly payment target instead.)",
    isAnswered: (d) => hasBudgetSignal(d),
  },
  {
    id: "targetAreas",
    question: "Which areas or cities are you most interested in?",
    isAnswered: (d) => d.targetAreas.length > 0,
  },
  {
    id: "propertyType",
    question:
      "What kind of property are you looking for — single-family, condo, townhome, multi-family, land, or commercial?",
    isAnswered: (d) => d.propertyType !== "unknown",
  },
  {
    id: "layout",
    question: "What's your ideal setup — bedrooms, bathrooms, or square footage range?",
    isAnswered: (d) => hasLayoutSignal(d),
  },
  {
    id: "mustHaves",
    question: "Any must-have features or deal breakers I should know about?",
    isAnswered: (d) => hasMustHavesOrDealbreakers(d),
  },
  {
    id: "moveInReady",
    question: "Do you prefer something move-in ready, or are you open to properties that need some work?",
    isAnswered: (d) => d.moveInReadyPreference !== "unknown",
  },
  {
    id: "timeline",
    question: "How soon are you looking to move forward with a purchase?",
    isAnswered: (d) => d.timeline.trim().length > 0,
  },
  {
    id: "housingSituation",
    question: "Are you currently renting, or do you need to sell a property first?",
    isAnswered: (d) =>
      d.currentHousingSituation.trim().length > 0 || d.mustSellFirst !== null,
  },
  {
    id: "decisionMakers",
    question: "Will you be the only decision-maker, or is someone else involved?",
    isAnswered: (d) => d.decisionMakers.trim().length > 0,
  },
  {
    id: "reasonForBuying",
    question: "What's the main reason you're looking to buy right now?",
    isAnswered: (d) => d.reasonForBuyingNow.trim().length > 0,
  },
  {
    id: "primaryFactor",
    question: "What matters most in your decision — price, location, condition, or long-term value?",
    isAnswered: (d) => d.primaryDecisionFactor !== "unknown",
  },
  {
    id: "offerCompetition",
    question: "Are you comfortable competing in multiple-offer situations if needed?",
    isAnswered: (d) => d.offerCompetitionComfort !== "unknown",
  },
  {
    id: "repairs",
    question: "Would you consider properties that may need repairs or improvements?",
    isAnswered: (d) => d.repairTolerance !== "unknown",
  },
  {
    id: "offMarket",
    question: "Are you open to opportunities like off-market deals or value-add properties?",
    isAnswered: (d) => d.offMarketInterest !== null,
  },
  {
    id: "experience",
    question: "Have you purchased real estate before, or is this your first time?",
    isAnswered: (d) => d.experienceLevel !== "unknown",
  },
  {
    id: "referrals",
    question: "Would you like help connecting with lenders, attorneys, or inspectors if needed?",
    isAnswered: (d) => d.referralNeeds.length > 0,
  },
  {
    id: "titleRisk",
    question:
      "Do you know of any title, lien, or mortgage complications we should flag for your advisor?",
    isAnswered: (d) =>
      d.knownTitleIssues !== null && d.knownLienIssues !== null && d.knownMortgageComplications !== null,
  },
  {
    id: "jurisdiction",
    question: "What state or jurisdiction will this transaction take place in?",
    isAnswered: (d) => d.jurisdiction.trim().length > 0,
  },
  {
    id: "summaryPrefs",
    question:
      "Would you like a simple client summary, a more detailed advisor version, or both?",
    isAnswered: (d) => d.wantsClientSummary !== null && d.wantsAdvisorSummary !== null,
  },
];

export function getQuestionCatalogLines(): string[] {
  return BUYER_INTAKE_STEPS.map((s, i) => `${i + 1}. [${s.id}] ${s.question}`);
}
