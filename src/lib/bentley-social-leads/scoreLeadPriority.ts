/**
 * Phase 4F — Lead prioritization: close likelihood + urgency (explainable heuristics).
 */

import type { ConversionSummary, TrackedLeadForAnalytics } from "@/lib/bentley-social-leads/computeConversionSummary";

export type LeadPriorityTier = "high" | "medium" | "low";

export type LeadPriorityScore = {
  closeLikelihood: number;
  urgency: number;
  tier: LeadPriorityTier;
  followUpNeeded: boolean;
  reasons: string[];
};

function parseIntent(s: string): number {
  const n = parseFloat(String(s));
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function daysSince(createdAt: Date | string): number {
  const t = typeof createdAt === "string" ? new Date(createdAt).getTime() : createdAt.getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 86400000;
}

export function scoreLeadPriority(lead: TrackedLeadForAnalytics, summary: ConversionSummary): LeadPriorityScore {
  const reasons: string[] = [];
  const intent = parseIntent(lead.intentScore);

  const topPlatforms = summary.byPlatform.slice(0, 4).map((d) => d.key);
  const platformBoost = topPlatforms.includes(lead.platform) ? 1 : 0.42;
  if (platformBoost > 0.9) reasons.push("Platform matches current top converters.");

  const topPains = summary.byPainType
    .filter((p) => p.key !== "(none)")
    .slice(0, 4)
    .map((d) => d.key);
  const painBoost =
    lead.painType && topPains.some((p) => p.toLowerCase() === lead.painType.toLowerCase()) ? 1 : 0.48;
  if (painBoost > 0.9) reasons.push("Pain theme aligns with converting segments.");

  const readiness = (lead.commercialReadiness ?? "").toLowerCase();
  let readinessBoost = 0.5;
  if (readiness.includes("high") || readiness.includes("ready") || readiness.includes("hot")) {
    readinessBoost = 1;
    reasons.push("Commercial readiness reads strong.");
  } else if (readiness.includes("low") || readiness.includes("cold")) {
    readinessBoost = 0.32;
  }

  let closeLikelihood = 0.38 * intent + 0.22 * platformBoost + 0.2 * painBoost + 0.2 * readinessBoost;

  if (lead.status === "closed") {
    closeLikelihood = 0.95;
    reasons.push("Already closed — maintain relationship / upsell.");
  } else if (lead.status === "booked") {
    closeLikelihood = Math.max(closeLikelihood, 0.78);
    reasons.push("Booked — push to close.");
  } else if (lead.status === "lost") {
    closeLikelihood = Math.min(closeLikelihood, 0.2);
    reasons.push("Marked lost — deprioritize unless re-engaged.");
  }

  const ageDays = daysSince(lead.createdAt);
  let urgency = 0.45;

  if (lead.status === "new") {
    if (ageDays > 7) {
      urgency = 0.95;
      reasons.push("New lead aging over a week — first touch overdue.");
    } else if (ageDays > 3) {
      urgency = 0.82;
      reasons.push("New lead aging 3+ days — follow up.");
    } else {
      urgency = 0.55 + intent * 0.2;
    }
  } else if (lead.status === "contacted") {
    urgency = ageDays > 5 ? 0.85 : 0.62;
    if (urgency > 0.75) reasons.push("Contacted but stalled — nudge toward book.");
  } else if (lead.status === "booked") {
    urgency = 0.68;
  } else if (lead.status === "closed" || lead.status === "lost") {
    urgency = 0.12;
  }

  const combined = closeLikelihood * 0.58 + urgency * 0.42;
  const tier: LeadPriorityTier = combined >= 0.62 ? "high" : combined >= 0.42 ? "medium" : "low";

  const followUpNeeded =
    (lead.status === "new" || lead.status === "contacted") && (urgency >= 0.65 || tier === "high");

  return {
    closeLikelihood: Math.min(1, Math.max(0, closeLikelihood)),
    urgency: Math.min(1, Math.max(0, urgency)),
    tier,
    followUpNeeded,
    reasons: reasons.slice(0, 4),
  };
}
