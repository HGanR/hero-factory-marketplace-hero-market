/**
 * Commercial readiness tier from capture path + engagement signals (deterministic).
 */

import type { CommercialReadiness } from "./types";
import type { PublicSocialSurface } from "./types";
import type { WebsiteSurface } from "./types";
import type { WebsiteGradeResult } from "./types";

export function inferCommercialReadiness(args: {
  social: PublicSocialSurface;
  website: WebsiteSurface | null;
  websiteGrade: WebsiteGradeResult | null;
  hasBuyerIntentInComments: boolean;
  overallCoverageScore: number;
}): CommercialReadiness {
  let score = 0;
  if (args.website?.ok) score += 2;
  if (args.website?.leadCapturePresent || args.website?.bookingPathPresent) score += 2;
  if (args.websiteGrade && ["A", "B"].includes(args.websiteGrade.websiteGrade)) score += 2;
  if (args.hasBuyerIntentInComments) score += 2;
  if (args.social.followerCount != null && args.social.followerCount > 2000) score += 1;
  if (args.social.bio && args.social.bio.length > 40) score += 1;
  if (args.overallCoverageScore >= 0.55) score += 1;

  if (score >= 7) return "high";
  if (score >= 4) return "moderate";
  return "low";
}
