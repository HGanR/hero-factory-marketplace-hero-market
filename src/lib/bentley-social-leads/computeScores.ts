/**
 * Score bundle — down-weights vanity metrics; up-weights demand + friction + fit for platform help.
 */

import type { CommercialCommentSignals } from "./types";
import type { PublicSocialSurface } from "./types";
import type { ScoreBundle } from "./types";
import type { WeakSpotTag } from "./types";
import type { WebsiteGradeResult } from "./types";
import type { WebsiteSurface } from "./types";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export function computeScores(
  social: PublicSocialSurface,
  weakSpots: WeakSpotTag[],
  hasBuyerIntentInComments: boolean,
  hasWebsiteSignals: boolean,
  site: WebsiteSurface | null,
  websiteGrade: WebsiteGradeResult | null,
  commercial?: CommercialCommentSignals,
  overallCoverageScore?: number
): ScoreBundle {
  const followerSignal =
    social.followerCount != null ? Math.min(1, Math.log10(social.followerCount + 10) / 6) : 0.2;

  /** Visibility: public surface quality, not follower count alone. */
  let visibilityScore = 0.25;
  if (social.accessStatus === "public") visibilityScore += 0.35;
  if (social.bio && social.bio.length > 20) visibilityScore += 0.15;
  if (social.posts.length > 0) visibilityScore += 0.15;
  visibilityScore += followerSignal * 0.08;
  visibilityScore = clamp01(visibilityScore);

  const commercialDemandBump =
    (commercial?.urgencySignals.length ?? 0) * 0.04 + (commercial?.locationOrServiceAreaQuestions.length ?? 0) * 0.02;

  let demandScore = clamp01(
    (hasBuyerIntentInComments ? 0.55 : 0.15) +
      Math.min(0.35, social.comments.length * 0.04) +
      (social.comments.some((c) => c.text.match(/price|how much|book/i)) ? 0.15 : 0) +
      commercialDemandBump
  );

  const intentScore = clamp01(
    demandScore * 0.7 +
      (social.posts.some((p) => p.classifications.includes("strong_buyer_intent")) ? 0.25 : 0) +
      ((commercial?.bookingFrictionSignals.length ?? 0) > 0 ? 0.05 : 0)
  );

  let frictionScore = clamp01(
    weakSpots.length * 0.07 +
      (weakSpots.includes("no_website") ? 0.12 : 0) +
      (weakSpots.includes("no_lead_capture") ? 0.1 : 0) +
      (weakSpots.includes("weak_cta") ? 0.08 : 0)
  );

  if (site?.ok) {
    if (!site.leadCapturePresent) frictionScore = clamp01(frictionScore + 0.06);
    if (!site.bookingPathPresent) frictionScore = clamp01(frictionScore + 0.04);
    if (!site.clearCtaPresent) frictionScore = clamp01(frictionScore + 0.03);
  }

  if (websiteGrade && websiteGrade.websiteGrade !== "unknown") {
    frictionScore = clamp01(frictionScore + websiteGrade.bookingFrictionScore * 0.08);
    if (websiteGrade.ctaClarityScore < 0.35) frictionScore = clamp01(frictionScore + 0.04);
  }

  if (commercial && commercial.bookingFrictionSignals.length >= 2) {
    frictionScore = clamp01(frictionScore + 0.05);
  }

  /** Fit for operational systems — heuristic. */
  let fitScore = 0.42;
  if (hasWebsiteSignals) fitScore += 0.12;
  if (site?.ok && site.bookingPathPresent) fitScore += 0.1;
  if (site?.ok && site.leadCapturePresent) fitScore += 0.08;
  if (weakSpots.includes("manual_follow_up_risk")) fitScore += 0.18;
  if (weakSpots.includes("no_booking_system") || weakSpots.includes("dm_booking_only")) fitScore += 0.1;
  if (websiteGrade && websiteGrade.websiteGrade !== "unknown") {
    fitScore += websiteGrade.leadCaptureScore * 0.08 + websiteGrade.contactAccessibilityScore * 0.06;
    fitScore -= websiteGrade.bookingFrictionScore * 0.05;
  }
  fitScore = clamp01(fitScore);

  const opportunityScore = clamp01(
    demandScore * 0.28 +
      intentScore * 0.22 +
      frictionScore * 0.2 +
      fitScore * 0.22 +
      visibilityScore * 0.08
  );

  let confidenceScore = 0.42;
  if (social.accessStatus === "public") confidenceScore += 0.2;
  if (social.bio) confidenceScore += 0.08;
  if (social.posts.length > 0) confidenceScore += 0.08;
  if (site?.ok && site.title) confidenceScore += 0.06;
  if (websiteGrade && ["A", "B"].includes(websiteGrade.websiteGrade)) confidenceScore += 0.04;
  if (social.accessStatus === "private" || social.accessStatus === "broken_link") confidenceScore *= 0.45;
  const cov = overallCoverageScore ?? 0.45;
  confidenceScore = clamp01(confidenceScore * (0.55 + cov * 0.45));

  return {
    visibilityScore,
    demandScore,
    intentScore,
    frictionScore,
    fitScore,
    opportunityScore,
    confidenceScore,
  };
}
