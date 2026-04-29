/**
 * Deterministic campaign notes from guided intake when the user has not pasted manual notes.
 * Used to unblock Campaign Prep / Generate Campaign without requiring a separate paste step.
 */

import { INDUSTRY_PROFILES } from "@/lib/revenue-os/industry-profiles";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";

export const BENTLEY_CAMPAIGN_NOTES_MIN = 10;

function effectiveIndustryLabel(s: BentleySnapshot): string {
  const fromProfile =
    s.industryKey != null ? (INDUSTRY_PROFILES[s.industryKey]?.label ?? "") : "";
  return (s.contentIndustry ?? "").trim() || fromProfile.trim();
}

export function buildBaselineCampaignNotesFromIntake(s: BentleySnapshot): string {
  const industry = effectiveIndustryLabel(s).trim() || "Not specified";
  const audience = (s.targetAudience ?? "").trim() || "General audience";
  const platforms = Array.isArray(s.platforms) ? s.platforms : [];
  const lines: string[] = [
    "## Campaign brief (auto-generated from guided intake)",
    "",
    "This block was generated from your AI Revenue OS answers so you can run **Generate Campaign** without pasting notes first.",
    "You can edit or append below — manual notes take priority when present.",
    "",
    `**Industry:** ${industry}`,
    `**Business name:** ${(s.businessName ?? "").trim() || "—"}`,
    `**Target audience:** ${audience}`,
    `**Core offer:** ${(s.coreOffer ?? "").trim() || "—"}`,
    `**Transformation / outcome:** ${(s.transformation ?? "").trim() || "—"}`,
    "",
    `**Content platforms (strategy):** ${platforms.length ? platforms.join(", ") : "—"}`,
    `**Posting platforms (OAuth intent):** ${s.postingPlatforms?.length ? s.postingPlatforms.join(", ") : "—"}`,
    `**Tone:** ${(s.tone ?? "").trim() || "—"}`,
    `**Content type:** ${(s.contentType ?? "").trim() || "—"}`,
    `**Image style:** ${(s.imageStyle ?? "").trim() || "—"}`,
    "",
  ];

  const rev: string[] = [];
  if (s.traffic > 0) rev.push(`Monthly traffic (approx.): ${s.traffic}`);
  if (s.conversionRate > 0) rev.push(`Conversion rate: ${s.conversionRate}%`);
  if (s.aov > 0) rev.push(`Average order value: $${s.aov}`);
  if (rev.length) {
    lines.push("**Revenue metrics (from intake):**", rev.map((x) => `• ${x}`).join("\n"), "");
  }

  lines.push(
    "**Direction for campaign:**",
    `Position ${(s.businessName ?? "").trim() || "the brand"} in ${industry} for ${audience}, leading with ${(s.coreOffer ?? "").trim() || "the offer"} and the promised outcome: ${(s.transformation ?? "").trim() || "see transformation above"}.`,
    "",
    "_End of auto-generated brief._"
  );

  return lines.join("\n").trim();
}
