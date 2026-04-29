/**
 * Deterministic website surface grading from fetched HTML signals (no screenshots/media).
 */

import type { WebsiteGradeLetter, WebsiteGradeResult, WebsiteSurface } from "./types";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function letterFromComposite(c: number): WebsiteGradeLetter {
  if (c >= 0.82) return "A";
  if (c >= 0.68) return "B";
  if (c >= 0.52) return "C";
  if (c >= 0.35) return "D";
  if (c > 0) return "F";
  return "unknown";
}

/**
 * Grade a successfully fetched site. For failed fetches, callers should pass null upstream.
 */
export function gradeWebsiteSurface(site: WebsiteSurface | null): WebsiteGradeResult | null {
  if (!site?.ok) {
    return {
      ctaClarityScore: 0,
      trustSignalScore: 0,
      bookingFrictionScore: 1,
      leadCaptureScore: 0,
      contactAccessibilityScore: 0,
      websiteGrade: "unknown",
      websiteGradeExplanation: "Site not reachable or fetch failed — grade withheld.",
    };
  }

  const ctaClarityScore = clamp01(
    (site.clearCtaPresent ? 0.55 : 0.12) + (site.title && site.title.length > 5 ? 0.2 : 0) + (site.description && site.description.length > 20 ? 0.15 : 0)
  );

  const trustSignalScore = clamp01(
    (site.reviewSignalPresent ? 0.45 : 0.1) + (site.hasReviewsHint ? 0.2 : 0) + (/testimonial|trusted|years? (of )?experience|licensed|insured/i.test(site.description ?? "") ? 0.2 : 0)
  );

  const bookingFrictionScore = clamp01(
    site.bookingPathPresent ? 0.15 : 0.72 + (site.hasBookingHint ? 0.08 : 0)
  );

  const leadCaptureScore = clamp01(
    (site.leadCapturePresent ? 0.55 : 0.12) + (site.hasEmailCaptureHint ? 0.25 : 0)
  );

  const hasPhoneOrEmail = /phone|email|tel:|mailto:/i.test(site.contactMethodSummary);
  const contactAccessibilityScore = clamp01(
    (hasPhoneOrEmail ? 0.45 : 0.15) + (/contact form|get in touch|submit/i.test(site.contactMethodSummary) ? 0.35 : 0.1)
  );

  const composite = clamp01(
    ctaClarityScore * 0.22 +
      trustSignalScore * 0.18 +
      (1 - bookingFrictionScore) * 0.22 +
      leadCaptureScore * 0.2 +
      contactAccessibilityScore * 0.18
  );

  const websiteGrade = letterFromComposite(composite);

  const parts: string[] = [];
  parts.push(site.clearCtaPresent ? "Clear CTA language detected." : "Weak or missing primary CTA.");
  parts.push(site.bookingPathPresent ? "Booking/scheduling path present." : "No obvious booking path — higher scheduling friction.");
  parts.push(site.leadCapturePresent ? "Lead capture signal (form/email)." : "Limited lead capture on visible copy.");
  parts.push(site.reviewSignalPresent ? "Review/testimonial signals." : "Few trust/review signals in visible text.");

  return {
    ctaClarityScore,
    trustSignalScore,
    bookingFrictionScore,
    leadCaptureScore,
    contactAccessibilityScore,
    websiteGrade,
    websiteGradeExplanation: parts.join(" "),
  };
}
