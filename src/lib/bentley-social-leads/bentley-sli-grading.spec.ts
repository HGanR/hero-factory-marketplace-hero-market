/**
 * @jest-environment node
 */

import { computeScoreExplanations } from "./computeScoreExplanations";
import { gradeWebsiteSurface } from "./gradeWebsiteSurface";
import type { CommercialCommentSignals, ScoreBundle, WebsiteSurface } from "./types";

function baseScores(): ScoreBundle {
  return {
    visibilityScore: 0.55,
    demandScore: 0.45,
    intentScore: 0.5,
    frictionScore: 0.4,
    fitScore: 0.5,
    opportunityScore: 0.48,
    confidenceScore: 0.55,
  };
}

function emptyCommercial(): CommercialCommentSignals {
  return {
    repeatedBuyerQuestions: [],
    objectionClusters: [],
    bookingFrictionSignals: [],
    urgencySignals: [],
    locationOrServiceAreaQuestions: [],
    repeatedAcrossPosts: false,
    repeatedAcrossPostsCount: 0,
  };
}

describe("gradeWebsiteSurface", () => {
  it("grades a strong conversion surface highly", () => {
    const site: WebsiteSurface = {
      url: "https://example.com",
      ok: true,
      title: "Book a consult — Example Co",
      description: "Trusted local service with reviews and testimonials.",
      hasEmailCaptureHint: true,
      hasBookingHint: true,
      hasReviewsHint: true,
      clearCtaPresent: true,
      bookingPathPresent: true,
      contactMethodSummary: "phone hints: 555-0100 · email fields/hints: hi@example.com",
      reviewSignalPresent: true,
      leadCapturePresent: true,
      notes: [],
    };
    const g = gradeWebsiteSurface(site);
    expect(g).not.toBeNull();
    expect(g!.websiteGrade).not.toBe("F");
    expect(g!.ctaClarityScore).toBeGreaterThan(0.4);
    expect(g!.bookingFrictionScore).toBeLessThan(0.5);
  });

  it("returns unknown grade when site fetch failed", () => {
    const g = gradeWebsiteSurface(null);
    expect(g?.websiteGrade).toBe("unknown");
  });
});

describe("computeScoreExplanations", () => {
  it("includes drivers and confidence rationale", () => {
    const scores = baseScores();
    const commercial = emptyCommercial();
    const ex = computeScoreExplanations(scores, {
      accessStatus: "public",
      weakSpotCount: 2,
      hasBuyerIntentInComments: true,
      commentCount: 3,
      postCount: 2,
      hasBio: true,
      siteOk: true,
      leadCapturePresent: true,
      bookingPathPresent: true,
      clearCtaPresent: true,
      websiteGrade: null,
      commercial,
      overallCoverageScore: 0.52,
    });
    expect(ex.top_positive_drivers.length).toBeGreaterThan(0);
    expect(ex.confidence_rationale.length).toBeGreaterThan(10);
    expect(ex.top_negative_drivers).toBeDefined();
  });
});
