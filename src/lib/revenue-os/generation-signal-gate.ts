/**
 * Reject campaign generation when unified context is too thin (no Bentley, no brief, very short user text).
 * Content-engine routes are not gated here — they carry structured business fields in the main prompt.
 */

import type { UnifiedGenerationContext } from "@/lib/revenue-os/unified-generation-types";

/** Minimum trimmed USER INPUT length when Bentley MI and campaign brief are both absent. */
export const MIN_CAMPAIGN_USER_INPUT_WITHOUT_BENTLEY_OR_BRIEF = 96;

export type ThinContextCheck = {
  tooThin: boolean;
  reason?: string;
};

export function checkCampaignUnifiedContextThin(
  ctx: UnifiedGenerationContext,
  userInputForPrompt: string
): ThinContextCheck {
  const u = userInputForPrompt.trim();
  const brief = ctx.campaignBrief.trim();
  const hasBentley = Boolean(ctx.bentleyMarketIntelligence);
  if (hasBentley || brief.length > 0) {
    return { tooThin: false };
  }
  if (u.length >= MIN_CAMPAIGN_USER_INPUT_WITHOUT_BENTLEY_OR_BRIEF) {
    return { tooThin: false };
  }
  return {
    tooThin: true,
    reason: `Add more detail in notes (at least ${MIN_CAMPAIGN_USER_INPUT_WITHOUT_BENTLEY_OR_BRIEF} characters), attach a Bentley handoff, or ensure a campaign brief is present in notes.`,
  };
}
