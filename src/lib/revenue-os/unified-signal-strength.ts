import type { UnifiedGenerationContext } from "@/lib/revenue-os/unified-generation-types";

export type UnifiedSignalStrength = "strong" | "medium" | "weak";

/**
 * STRONG: Bentley OR (campaignBrief + userInputLength > 120)
 * MEDIUM: campaignBrief OR userInputLength > 120
 * WEAK: everything else
 */
export function classifyUnifiedSignalStrength(
  ctx: UnifiedGenerationContext,
  userInputLength: number
): UnifiedSignalStrength {
  const hasBentley = Boolean(ctx.bentleyMarketIntelligence);
  const briefLen = ctx.campaignBrief.trim().length;
  const hasBrief = briefLen > 0;
  const longUser = userInputLength > 120;

  if (hasBentley || (hasBrief && longUser)) return "strong";
  if (hasBrief || longUser) return "medium";
  return "weak";
}
