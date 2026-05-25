import type { ConversionSummary } from "@/lib/bentley-social-leads/computeConversionSummary";
import type { StructuredRecommendation, TopPerformingSnapshot } from "@/lib/bentley-social-leads/conversionRecommendations";
import type { BentleyStructuredMarketIntelligence } from "@/lib/revenue-os/bentley-generation-context";

export type NextCampaignBrief = {
  headline: string;
  bullets: string[];
  bentleyInjected: boolean;
};

export function buildNextCampaignBrief(input: {
  summary: ConversionSummary;
  topPerforming: TopPerformingSnapshot;
  recommendations: StructuredRecommendation[];
  bentley: BentleyStructuredMarketIntelligence | null;
}): NextCampaignBrief {
  const bullets = input.recommendations
    .slice(0, 6)
    .map((r) => `${r.kind}: ${r.label} — ${r.rationale}`.slice(0, 320));
  if (input.topPerforming.platforms.length) {
    bullets.push(`Top platforms (snapshot): ${input.topPerforming.platforms.slice(0, 4).join(", ")}`);
  }
  if (input.bentley) {
    bullets.push("Bentley market intelligence attached for operator review.");
  }
  void input.summary;
  return {
    headline: "Next campaign brief (operator-facing, deterministic)",
    bullets,
    bentleyInjected: Boolean(input.bentley),
  };
}
