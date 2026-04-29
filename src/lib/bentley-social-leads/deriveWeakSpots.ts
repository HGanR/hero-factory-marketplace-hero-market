/**
 * Map surfaces + normalized lead to weak-spot tags (deterministic heuristics).
 */

import type { CommercialCommentSignals } from "./types";
import type { NormalizedLead } from "./types";
import type { PublicSocialSurface } from "./types";
import type { WebsiteGradeResult } from "./types";
import type { WebsiteSurface } from "./types";
import type { WeakSpotTag } from "./types";

export function deriveWeakSpots(
  lead: NormalizedLead,
  social: PublicSocialSurface,
  site: WebsiteSurface | null,
  commercial?: CommercialCommentSignals,
  websiteGrade?: WebsiteGradeResult | null
): WeakSpotTag[] {
  const tags = new Set<WeakSpotTag>();

  if (!lead.websiteUrl && !social.linkInBio) tags.add("no_website");
  if (site?.ok === false && lead.websiteUrl) tags.add("outdated_site");

  const bio = `${social.bio ?? ""} ${social.displayName ?? ""}`.toLowerCase();
  if (/dm me|message me|link in bio only|no website/i.test(bio)) tags.add("dm_booking_only");
  if (/calendly|book/i.test(bio) && !/http/i.test(bio)) tags.add("no_booking_system");

  if (site?.ok) {
    if (!site.leadCapturePresent && !lead.email) tags.add("no_email_capture");
    if (!site.bookingPathPresent && /service|coach|consult|spa|salon|clinic|repair|contract/i.test(bio)) {
      tags.add("no_booking_system");
    }
    if (!site.reviewSignalPresent) tags.add("no_reviews_visible");
    if (!site.clearCtaPresent) tags.add("weak_cta");
    if (!site.leadCapturePresent) tags.add("no_lead_capture");
  }

  if (websiteGrade && websiteGrade.websiteGrade !== "unknown") {
    if (websiteGrade.bookingFrictionScore >= 0.65) tags.add("no_booking_system");
    if (websiteGrade.ctaClarityScore < 0.35) tags.add("weak_cta");
    if (websiteGrade.leadCaptureScore < 0.3) tags.add("no_lead_capture");
  }

  if (commercial && commercial.bookingFrictionSignals.length >= 2) {
    tags.add("manual_follow_up_risk");
  }
  if (commercial && commercial.repeatedAcrossPosts && commercial.repeatedAcrossPostsCount >= 2) {
    tags.add("manual_follow_up_risk");
    tags.add("weak_offer_clarity");
  }
  if (commercial && commercial.locationOrServiceAreaQuestions.length >= 3) {
    tags.add("weak_offer_clarity");
  }

  if (social.posts.some((p) => p.classifications.includes("weak_cta"))) tags.add("weak_cta");
  if (social.posts.some((p) => p.classifications.includes("direct_offer") && p.classifications.includes("weak_cta"))) {
    tags.add("weak_offer_clarity");
  }

  if (!lead.email && !site?.leadCapturePresent) tags.add("no_lead_capture");
  if (
    social.comments.filter((c) => c.classifications.includes("buyer_intent")).length > 0 &&
    tags.has("no_lead_capture")
  ) {
    tags.add("manual_follow_up_risk");
  }

  if (social.accessStatus !== "public") tags.add("low_trust_signals");
  if (social.posts.length < 2 && social.accessStatus === "access_limited") tags.add("inconsistent_branding");

  return [...tags];
}
