import type { BuyerDraft, BuyerFinancingType, BuyerPropertyType } from "@/lib/maania/buyer-draft";

export function formatFinancing(f: BuyerFinancingType): string {
  switch (f) {
    case "preapproved":
      return "Pre-approved for a mortgage";
    case "cash":
      return "Cash purchase";
    case "needs_lender":
      return "Needs lender connection / not yet pre-approved";
    default:
      return "Not specified yet";
  }
}

export function formatPropertyTypeLabel(pt: BuyerPropertyType): string {
  const map: Record<Exclude<BuyerPropertyType, "unknown">, string> = {
    single_family: "Single-family home",
    condo: "Condo",
    townhome: "Townhome",
    multi_family: "Multi-family (2–4 units)",
    land: "Land / lot",
    commercial: "Commercial",
    other: "Other / mixed",
  };
  return pt === "unknown" ? "Not specified yet" : map[pt];
}

export function formatBudgetText(d: BuyerDraft): string {
  const parts: string[] = [];
  if (d.budgetMin != null && d.budgetMax != null) {
    parts.push(`$${d.budgetMin.toLocaleString()} – $${d.budgetMax.toLocaleString()}`);
  } else if (d.budgetMax != null) {
    parts.push(`Up to $${d.budgetMax.toLocaleString()}`);
  } else if (d.budgetMin != null) {
    parts.push(`From $${d.budgetMin.toLocaleString()}`);
  }
  if (d.monthlyPaymentTarget != null) {
    parts.push(`~$${d.monthlyPaymentTarget.toLocaleString()}/mo target payment`);
  }
  return parts.length ? parts.join(" · ") : "Not specified yet";
}

export function formatBedroomsText(d: BuyerDraft): string {
  if (d.bedrooms == null) return "—";
  return `${d.bedrooms}+ bed${d.bedrooms === 1 ? "" : "s"}`;
}

export function formatBathroomsText(d: BuyerDraft): string {
  if (d.bathrooms == null) return "—";
  const n = d.bathrooms;
  return `${Number.isInteger(n) ? n : n} bath${n === 1 ? "" : "s"}`;
}

export function formatSqftRange(d: BuyerDraft): string {
  if (d.sqftMin != null && d.sqftMax != null) {
    return `${d.sqftMin.toLocaleString()} – ${d.sqftMax.toLocaleString()} sq ft`;
  }
  if (d.sqftMin != null) return `${d.sqftMin.toLocaleString()}+ sq ft`;
  if (d.sqftMax != null) return `Up to ${d.sqftMax.toLocaleString()} sq ft`;
  return "";
}

function formatMoveInPreference(d: BuyerDraft): string {
  switch (d.moveInReadyPreference) {
    case "move_in_ready":
      return "Prefers move-in ready / turnkey";
    case "open_to_work":
      return "Open to work / fixer opportunities";
    default:
      return "";
  }
}

export function formatDecisionFactor(d: BuyerDraft): string {
  switch (d.primaryDecisionFactor) {
    case "price":
      return "Price";
    case "location":
      return "Location";
    case "condition":
      return "Condition / layout";
    case "long_term_value":
      return "Long-term value / appreciation";
    default:
      return "";
  }
}

/** Short narrative for occupancy / intent without a dedicated field on BuyerDraft. */
export function deriveOccupancyGoalLine(d: BuyerDraft): string {
  if (d.experienceLevel === "investor") {
    return "Investment / income-oriented search";
  }
  const bits: string[] = [];
  if (d.experienceLevel === "first_time") bits.push("First-time buyer");
  if (d.offMarketInterest === true) bits.push("Open to off-market / value-add");
  const cond = formatMoveInPreference(d);
  if (cond) bits.push(cond);
  if (bits.length) return bits.join(" · ");
  if (d.timeline.trim()) return `Active search — ${d.timeline}`;
  return "Buyer qualification in progress";
}

export function formatComfort(label: "offer" | "repair", d: BuyerDraft): string {
  const v = label === "offer" ? d.offerCompetitionComfort : d.repairTolerance;
  switch (v) {
    case "low":
      return label === "offer" ? "Cautious in multiple-offer situations" : "Prefers minimal repairs";
    case "medium":
      return label === "offer" ? "Moderate comfort competing" : "Open to moderate repairs";
    case "high":
      return label === "offer" ? "Comfortable competing on offers" : "Open to heavier renovation";
    default:
      return "";
  }
}

export function formatRepairTolerance(d: BuyerDraft): string {
  return formatComfort("repair", d);
}

export function buildDecisionSummaryLine(d: BuyerDraft): string {
  const bits: string[] = [];
  if (d.decisionMakers.trim()) bits.push(d.decisionMakers.trim());
  const pf = formatDecisionFactor(d);
  if (pf) bits.push(`Primary focus: ${pf}`);
  if (d.reasonForBuyingNow.trim()) bits.push(d.reasonForBuyingNow.trim());
  return bits.length ? bits.join(" · ") : "Decision dynamics not fully captured yet.";
}
