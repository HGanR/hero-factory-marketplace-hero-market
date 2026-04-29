/**
 * Manual-only outreach angles — operator guidance strings (not automated sends).
 */

import type { CommercialReadiness, InferredLeadType, NormalizedLead } from "./types";
import type { PublicSocialSurface } from "./types";
import type { ScoreBundle } from "./types";
import type { SuggestedActionTag } from "./types";

export function buildManualApproachSuggestions(
  lead: NormalizedLead,
  social: PublicSocialSurface,
  scores: ScoreBundle,
  bestOfferAngle: string,
  opts?: { inferredLeadType?: InferredLeadType; commercialReadiness?: CommercialReadiness }
): {
  suggestedCommentAngle: string;
  suggestedFollowMessageAngle: string;
  suggestedEmailAngle: string;
  suggestedNextMove: string;
  suggestedActionTags: SuggestedActionTag[];
} {
  const tags: SuggestedActionTag[] = [];
  if (scores.opportunityScore >= 0.55) tags.push("manual_comment");
  if (lead.email) tags.push("manual_email");
  tags.push("manual_follow");
  if (scores.opportunityScore < 0.35) tags.push("low_priority");
  if (social.accessStatus !== "public") tags.push("watch_only");
  if (opts?.commercialReadiness === "low") tags.push("watch_only");
  if (opts?.inferredLeadType === "creator_brand" && scores.opportunityScore < 0.45) tags.push("watch_only");

  const platform = lead.platform;
  const name = lead.businessName || lead.handle;

  const suggestedCommentAngle =
    social.accessStatus === "public"
      ? `Public thread: acknowledge a specific post caption, ask one qualification question, point to ${bestOfferAngle.split("—")[0].trim()}.`
      : `Limited surface: avoid generic pitch — reference what is visible and invite them to a neutral next step (no automation).`;

  const suggestedFollowMessageAngle =
    lead.profileUrl
      ? `If/when they follow back is unknown — keep a single saved note: who they serve, friction you saw, ${bestOfferAngle.slice(0, 120)}`
      : `No profile URL — capture business context from your notes before any manual follow.`;

  const suggestedEmailAngle = lead.email
    ? `Email: subject ties to visible buyer question theme; body: 3 bullets (what you saw, one hypothesis, one ask). No bulk sends from Bentley.`
    : `No email on lead — use site capture or manual research; do not scrape private contacts.`;

  const suggestedNextMove =
    scores.opportunityScore >= 0.5
      ? `Priority: map ${name} on ${platform} — validate ${bestOfferAngle.split("—")[0].trim()} in a manual touch this week.`
      : `Watchlist: revisit after more public posts or when website/DM capture improves.`;

  return {
    suggestedCommentAngle,
    suggestedFollowMessageAngle,
    suggestedEmailAngle,
    suggestedNextMove,
    suggestedActionTags: [...new Set(tags)],
  };
}
