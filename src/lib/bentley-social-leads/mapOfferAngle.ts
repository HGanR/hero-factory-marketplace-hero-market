/**
 * Pick a concise offer angle from weak spots + scores (template-based, extensible).
 */

import type { WeakSpotTag } from "./types";

export function mapOfferAngle(weakSpots: WeakSpotTag[], businessHint: string): string {
  if (weakSpots.includes("no_lead_capture") || weakSpots.includes("no_email_capture")) {
    return "Lead capture + follow-up rails — move conversations off volatile DMs into owned email/SMS.";
  }
  if (weakSpots.includes("no_booking_system") || weakSpots.includes("dm_booking_only")) {
    return "Scheduling + qualification — replace informal DMs with a single booking + intake link.";
  }
  if (weakSpots.includes("weak_offer_clarity") || weakSpots.includes("weak_cta")) {
    return "Offer clarity — tighten one primary CTA per post with a concrete next step.";
  }
  if (weakSpots.includes("no_website")) {
    return "Credibility surface — lightweight landing page that mirrors bio promise and captures intent.";
  }
  if (weakSpots.includes("manual_follow_up_risk")) {
    return "Pipeline hygiene — templates + SLA for inbound comment/DM questions so leads don’t stall.";
  }
  return `Operational leverage for ${businessHint || "this account"} — reduce manual coordination and clarify conversion path.`;
}
