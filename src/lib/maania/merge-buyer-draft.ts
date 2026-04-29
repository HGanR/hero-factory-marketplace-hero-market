import type { BuyerDraft } from "@/lib/maania/buyer-draft";

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = raw.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** Deep-merge patch into current; preserves strong existing values when patch is empty/ambiguous. */
export function mergeBuyerDraft(current: BuyerDraft, patch: Partial<BuyerDraft>): BuyerDraft {
  const next: BuyerDraft = { ...current };

  if (patch.financing !== undefined && patch.financing !== "unknown") {
    next.financing = patch.financing;
  } else if (patch.financing === "unknown" && current.financing === "unknown") {
    next.financing = "unknown";
  }

  const num = (a: number | null | undefined, b: number | null | undefined) =>
    b !== null && b !== undefined ? b : a ?? null;

  next.budgetMin = num(current.budgetMin, patch.budgetMin);
  next.budgetMax = num(current.budgetMax, patch.budgetMax);
  next.monthlyPaymentTarget = num(current.monthlyPaymentTarget, patch.monthlyPaymentTarget);

  if (patch.targetAreas !== undefined) {
    next.targetAreas = dedupeStrings([...current.targetAreas, ...patch.targetAreas]);
  }

  if (patch.propertyType !== undefined && patch.propertyType !== "unknown") {
    next.propertyType = patch.propertyType;
  }

  next.bedrooms = num(current.bedrooms, patch.bedrooms);
  next.bathrooms = num(current.bathrooms, patch.bathrooms);
  next.sqftMin = num(current.sqftMin, patch.sqftMin);
  next.sqftMax = num(current.sqftMax, patch.sqftMax);

  if (patch.moveInReadyPreference !== undefined && patch.moveInReadyPreference !== "unknown") {
    next.moveInReadyPreference = patch.moveInReadyPreference;
  }

  if (patch.mustHaves !== undefined) {
    next.mustHaves = dedupeStrings([...current.mustHaves, ...patch.mustHaves]);
  }
  if (patch.dealBreakers !== undefined) {
    next.dealBreakers = dedupeStrings([...current.dealBreakers, ...patch.dealBreakers]);
  }

  if (patch.timeline !== undefined && patch.timeline.trim()) {
    next.timeline = patch.timeline.trim();
  }

  if (patch.currentHousingSituation !== undefined && patch.currentHousingSituation.trim()) {
    next.currentHousingSituation = patch.currentHousingSituation.trim();
  }

  if (patch.mustSellFirst !== null && patch.mustSellFirst !== undefined) {
    next.mustSellFirst = patch.mustSellFirst;
  }

  if (patch.offerCompetitionComfort !== undefined && patch.offerCompetitionComfort !== "unknown") {
    next.offerCompetitionComfort = patch.offerCompetitionComfort;
  }
  if (patch.repairTolerance !== undefined && patch.repairTolerance !== "unknown") {
    next.repairTolerance = patch.repairTolerance;
  }

  if (patch.offMarketInterest !== null && patch.offMarketInterest !== undefined) {
    next.offMarketInterest = patch.offMarketInterest;
  }

  if (patch.experienceLevel !== undefined && patch.experienceLevel !== "unknown") {
    next.experienceLevel = patch.experienceLevel;
  }

  if (patch.referralNeeds !== undefined) {
    next.referralNeeds = dedupeStrings([...current.referralNeeds, ...patch.referralNeeds]);
  }

  if (patch.decisionMakers !== undefined && patch.decisionMakers.trim()) {
    next.decisionMakers = patch.decisionMakers.trim();
  }

  if (patch.primaryDecisionFactor !== undefined && patch.primaryDecisionFactor !== "unknown") {
    next.primaryDecisionFactor = patch.primaryDecisionFactor;
  }

  if (patch.reasonForBuyingNow !== undefined && patch.reasonForBuyingNow.trim()) {
    next.reasonForBuyingNow = patch.reasonForBuyingNow.trim();
  }

  if (patch.knownTitleIssues !== null && patch.knownTitleIssues !== undefined) {
    next.knownTitleIssues = patch.knownTitleIssues;
  }
  if (patch.knownLienIssues !== null && patch.knownLienIssues !== undefined) {
    next.knownLienIssues = patch.knownLienIssues;
  }
  if (patch.knownMortgageComplications !== null && patch.knownMortgageComplications !== undefined) {
    next.knownMortgageComplications = patch.knownMortgageComplications;
  }

  if (patch.jurisdiction !== undefined && patch.jurisdiction.trim()) {
    next.jurisdiction = patch.jurisdiction.trim();
  }

  if (patch.wantsClientSummary !== null && patch.wantsClientSummary !== undefined) {
    next.wantsClientSummary = patch.wantsClientSummary;
  }
  if (patch.wantsAdvisorSummary !== null && patch.wantsAdvisorSummary !== undefined) {
    next.wantsAdvisorSummary = patch.wantsAdvisorSummary;
  }

  return next;
}
