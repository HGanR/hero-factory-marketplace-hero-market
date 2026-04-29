import type { BuyerDraft } from "@/lib/maania/buyer-draft";
import { BUYER_INTAKE_STEPS } from "@/lib/maania/buyer-question-flow";

export type BuyerIntakeProgress = {
  answeredCount: number;
  totalCount: number;
  percent: number;
  missingFields: string[];
  suggestedNextBuyerQuestion: string | null;
};

export function getBuyerIntakeProgress(current: BuyerDraft): BuyerIntakeProgress {
  const totalCount = BUYER_INTAKE_STEPS.length;
  const missing: string[] = [];
  let answered = 0;
  let nextQ: string | null = null;

  for (const step of BUYER_INTAKE_STEPS) {
    if (step.isAnswered(current)) {
      answered += 1;
    } else {
      missing.push(step.id);
      if (nextQ === null) nextQ = step.question;
    }
  }

  const percent = totalCount === 0 ? 0 : Math.round((answered / totalCount) * 100);

  return {
    answeredCount: answered,
    totalCount,
    percent,
    missingFields: missing,
    suggestedNextBuyerQuestion: nextQ,
  };
}

export function getNextBuyerQuestion(current: BuyerDraft): string | null {
  return getBuyerIntakeProgress(current).suggestedNextBuyerQuestion;
}

/** Flat snapshot for retSnapshot — omits unknown / empty fields to save tokens. */
export function buyerDraftToProgressSnapshot(d: BuyerDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (d.financing !== "unknown") out.financing = d.financing;
  if (d.budgetMin != null) out.budgetMin = d.budgetMin;
  if (d.budgetMax != null) out.budgetMax = d.budgetMax;
  if (d.monthlyPaymentTarget != null) out.monthlyPaymentTarget = d.monthlyPaymentTarget;

  if (d.targetAreas.length) out.targetAreas = d.targetAreas;
  if (d.propertyType !== "unknown") out.propertyType = d.propertyType;
  if (d.bedrooms != null) out.bedrooms = d.bedrooms;
  if (d.bathrooms != null) out.bathrooms = d.bathrooms;
  if (d.sqftMin != null) out.sqftMin = d.sqftMin;
  if (d.sqftMax != null) out.sqftMax = d.sqftMax;

  if (d.moveInReadyPreference !== "unknown") out.moveInReadyPreference = d.moveInReadyPreference;
  if (d.mustHaves.length) out.mustHaves = d.mustHaves;
  if (d.dealBreakers.length) out.dealBreakers = d.dealBreakers;

  if (d.timeline.trim()) out.timeline = d.timeline.trim();
  if (d.currentHousingSituation.trim()) out.currentHousingSituation = d.currentHousingSituation.trim();
  if (d.mustSellFirst !== null) out.mustSellFirst = d.mustSellFirst;

  if (d.offerCompetitionComfort !== "unknown") out.offerCompetitionComfort = d.offerCompetitionComfort;
  if (d.repairTolerance !== "unknown") out.repairTolerance = d.repairTolerance;
  if (d.offMarketInterest !== null) out.offMarketInterest = d.offMarketInterest;

  if (d.experienceLevel !== "unknown") out.experienceLevel = d.experienceLevel;
  if (d.referralNeeds.length) out.referralNeeds = d.referralNeeds;

  if (d.decisionMakers.trim()) out.decisionMakers = d.decisionMakers.trim();
  if (d.primaryDecisionFactor !== "unknown") out.primaryDecisionFactor = d.primaryDecisionFactor;
  if (d.reasonForBuyingNow.trim()) out.reasonForBuyingNow = d.reasonForBuyingNow.trim();

  if (d.knownTitleIssues !== null) out.knownTitleIssues = d.knownTitleIssues;
  if (d.knownLienIssues !== null) out.knownLienIssues = d.knownLienIssues;
  if (d.knownMortgageComplications !== null)
    out.knownMortgageComplications = d.knownMortgageComplications;

  if (d.jurisdiction.trim()) out.jurisdiction = d.jurisdiction.trim();
  if (d.wantsClientSummary !== null) out.wantsClientSummary = d.wantsClientSummary;
  if (d.wantsAdvisorSummary !== null) out.wantsAdvisorSummary = d.wantsAdvisorSummary;

  return out;
}
