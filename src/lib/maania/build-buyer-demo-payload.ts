import type { BuyerDraft } from "@/lib/maania/buyer-draft";
import { getBuyerIntakeProgress } from "@/lib/maania/buyer-progress";
import {
  buildDecisionSummaryLine,
  deriveOccupancyGoalLine,
  formatBedroomsText,
  formatBathroomsText,
  formatBudgetText,
  formatComfort,
  formatDecisionFactor,
  formatFinancing,
  formatPropertyTypeLabel,
  formatRepairTolerance,
  formatSqftRange,
} from "@/lib/maania/build-buyer-summary";

/** Include structured demo payload in widget retSnapshot when intake is mature enough. */
export const BUYER_DEMO_PAYLOAD_MIN_PERCENT = 45;

/** Session preview opens (directional) — thin data ok. */
export const BUYER_PREVIEW_DIRECTION_MIN_PERCENT = 25;

/** Full Site Builder schema + “tailored demo” messaging. */
export const BUYER_TAILORED_DEMO_MIN_PERCENT = 50;

export function shouldAttachBuyerDemoPayload(percent: number): boolean {
  return percent >= BUYER_DEMO_PAYLOAD_MIN_PERCENT;
}

export interface BuyerDemoPayload {
  heroTitle: string;
  heroSubtitle: string;
  buyerProfile: {
    financing: string;
    budgetText: string;
    targetAreas: string[];
    propertyType: string;
    bedroomsText: string;
    bathroomsText: string;
    timeline: string;
    occupancyGoal: string;
  };
  priorities: string[];
  dealBreakers: string[];
  decisionSummary: string;
  readiness: {
    progressPercent: number;
    answeredCount: number;
    totalCount: number;
    nextBestQuestion: string | null;
  };
  agentSummary: string[];
  clientFacingSummary: string[];
  ctaLabel: string;
}

function buildAgentSummaryBullets(d: BuyerDraft, progress: ReturnType<typeof getBuyerIntakeProgress>): string[] {
  const lines: string[] = [];
  lines.push(`Financing: ${formatFinancing(d.financing)}`);
  lines.push(`Budget / payment: ${formatBudgetText(d)}`);
  if (d.targetAreas.length) lines.push(`Target markets: ${d.targetAreas.join(", ")}`);
  lines.push(`Property type: ${formatPropertyTypeLabel(d.propertyType)}`);
  const sq = formatSqftRange(d);
  const layout = [formatBedroomsText(d), formatBathroomsText(d), sq].filter(Boolean).join(" · ");
  if (layout.replace(/[·—]/g, "").trim()) lines.push(`Layout / size: ${layout}`);
  if (d.timeline.trim()) lines.push(`Timeline: ${d.timeline.trim()}`);
  if (d.currentHousingSituation.trim()) lines.push(`Current housing: ${d.currentHousingSituation.trim()}`);
  if (d.mustSellFirst !== null) {
    lines.push(`Must sell first: ${d.mustSellFirst ? "Yes — sale contingency likely" : "No / not a blocker"}`);
  }
  const oc = formatComfort("offer", d);
  const rt = formatRepairTolerance(d);
  if (oc) lines.push(`Offer competition: ${oc}`);
  if (rt) lines.push(`Repair tolerance: ${rt}`);
  if (d.offMarketInterest !== null) {
    lines.push(`Off-market interest: ${d.offMarketInterest ? "Yes" : "Prefer on-market / MLS"}`);
  }
  if (d.experienceLevel !== "unknown") {
    const expLabel =
      d.experienceLevel === "first_time"
        ? "First-time buyer"
        : d.experienceLevel === "repeat"
          ? "Repeat buyer"
          : "Investor";
    lines.push(`Experience: ${expLabel}`);
  }
  if (d.referralNeeds.length) {
    lines.push(
      `Referral needs: ${d.referralNeeds.map((x) => (x === "declined" ? "None / declined" : x)).join(", ")}`
    );
  }
  if (d.decisionMakers.trim()) lines.push(`Decision-makers: ${d.decisionMakers.trim()}`);
  const pf = formatDecisionFactor(d);
  if (pf) lines.push(`Top decision factor: ${pf}`);
  if (d.reasonForBuyingNow.trim()) lines.push(`Motivation: ${d.reasonForBuyingNow.trim()}`);
  if (d.jurisdiction.trim()) lines.push(`Jurisdiction: ${d.jurisdiction.trim()}`);
  const riskBits: string[] = [];
  if (d.knownTitleIssues === true) riskBits.push("title flags");
  if (d.knownLienIssues === true) riskBits.push("lien flags");
  if (d.knownMortgageComplications === true) riskBits.push("mortgage complexity");
  if (riskBits.length) lines.push(`Risk notes (buyer-reported): ${riskBits.join(", ")} — confirm with counsel/title.`);

  lines.push(`Intake completeness: ${progress.answeredCount}/${progress.totalCount} (${progress.percent}%)`);
  return lines;
}

function buildClientFacingBullets(d: BuyerDraft): string[] {
  const out: string[] = [];
  const budget = formatBudgetText(d);
  if (budget !== "Not specified yet") {
    out.push(`We're aligning search options around your budget and payment comfort (${budget}).`);
  }
  if (d.targetAreas.length) {
    out.push(`Focus areas: ${d.targetAreas.join(", ")}.`);
  }
  const pt = formatPropertyTypeLabel(d.propertyType);
  if (pt !== "Not specified yet") out.push(`Looking for: ${pt}.`);
  if (d.timeline.trim()) {
    out.push(`Timing: ${d.timeline.trim()}.`);
  }
  if (d.mustHaves.length) {
    out.push(`Must-haves: ${d.mustHaves.join("; ")}.`);
  }
  if (d.dealBreakers.length) {
    out.push(`Deal-breakers to avoid: ${d.dealBreakers.join("; ")}.`);
  }
  if (!out.length) {
    out.push("We’re still capturing your preferences — answer a few quick questions and we’ll personalize this page.");
  }
  return out;
}

function buildHero(d: BuyerDraft): { title: string; subtitle: string } {
  const areas = d.targetAreas.length ? d.targetAreas.slice(0, 3).join(" · ") : "your markets";
  const budget = formatBudgetText(d);
  const title =
    d.experienceLevel === "first_time"
      ? `Your first-home roadmap — ${areas}`
      : `Buyer strategy snapshot — ${areas}`;

  const subtitleParts: string[] = [];
  if (budget !== "Not specified yet") subtitleParts.push(budget);
  if (d.timeline.trim()) subtitleParts.push(d.timeline.trim());
  if (!subtitleParts.length) subtitleParts.push("Structured buyer profile for faster matching and stronger offers.");
  return { title, subtitle: subtitleParts.join(" · ") };
}

/**
 * Sitebuilder / demo-ready payload from grounded BuyerDraft + computed progress.
 */
export function buildBuyerDemoPayload(buyerDraft: BuyerDraft): BuyerDemoPayload {
  const progress = getBuyerIntakeProgress(buyerDraft);
  const hero = buildHero(buyerDraft);

  const priorities: string[] = [];
  if (buyerDraft.mustHaves.length) priorities.push(...buyerDraft.mustHaves);
  const pf = formatDecisionFactor(buyerDraft);
  if (pf) priorities.push(`Top priority: ${pf}`);
  if (buyerDraft.moveInReadyPreference === "move_in_ready") priorities.push("Move-in ready preferred");
  if (buyerDraft.moveInReadyPreference === "open_to_work") priorities.push("Open to renovation / value-add");

  return {
    heroTitle: hero.title,
    heroSubtitle: hero.subtitle,
    buyerProfile: {
      financing: formatFinancing(buyerDraft.financing),
      budgetText: formatBudgetText(buyerDraft),
      targetAreas: [...buyerDraft.targetAreas],
      propertyType: formatPropertyTypeLabel(buyerDraft.propertyType),
      bedroomsText: formatBedroomsText(buyerDraft),
      bathroomsText: formatBathroomsText(buyerDraft),
      timeline: buyerDraft.timeline.trim() || "—",
      occupancyGoal: deriveOccupancyGoalLine(buyerDraft),
    },
    priorities: priorities.length ? priorities : ["(Add must-haves as you chat — they’ll appear here.)"],
    dealBreakers: buyerDraft.dealBreakers.length ? [...buyerDraft.dealBreakers] : [],
    decisionSummary: buildDecisionSummaryLine(buyerDraft),
    readiness: {
      progressPercent: progress.percent,
      answeredCount: progress.answeredCount,
      totalCount: progress.totalCount,
      nextBestQuestion: progress.suggestedNextBuyerQuestion,
    },
    agentSummary: buildAgentSummaryBullets(buyerDraft, progress),
    clientFacingSummary: buildClientFacingBullets(buyerDraft),
    ctaLabel:
      progress.percent >= 70
        ? "Schedule a curated tour strategy call"
        : "Continue intake — we’ll refine this page live",
  };
}
