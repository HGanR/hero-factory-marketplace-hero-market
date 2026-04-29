/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  computePromotionDecisionSummaryForCampaign,
  promotionDecisionDominantReasonText,
  promotionDecisionExplainabilityStatusText,
  promotionDecisionTopStatusLabelText,
  type PaidSocialCampaignPublic,
} from "@/lib/social/paid-social-campaigns";

const INSUFFICIENT_ROWS_TEXT =
  "Need at least 2 comparable linked drafts for a campaign-level promotion summary.";

function row(partial: Partial<PaidSocialCampaignPublic> & { id: string }): PaidSocialCampaignPublic {
  return partial as PaidSocialCampaignPublic;
}

describe("computePromotionDecisionSummaryForCampaign (Part 63–67)", () => {
  it("returns undefined when no organic references", () => {
    expect(computePromotionDecisionSummaryForCampaign([row({ id: "a", referenceCampaignPostId: null })])).toBeUndefined();
    expect(computePromotionDecisionSummaryForCampaign([])).toBeUndefined();
  });

  it("counts all effective (comparable, no inefficient)", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      }),
      row({
        id: "b",
        referenceCampaignPostId: "p2",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      }),
    ]);
    expect(s).toEqual({
      referencedOrganicCount: 2,
      comparableCount: 2,
      effectiveCount: 2,
      inefficientCount: 0,
      notReadyCount: 0,
      topStatusLabel: "promotion_effective",
      topStatusLabelText: promotionDecisionTopStatusLabelText("promotion_effective"),
      explainabilityStatus: "ready",
    });
    expect(s?.explainabilityStatusText).toBeUndefined();
  });

  it("counts all not ready (comparable false); Part 64 omits topStatusLabel when comparableCount < 2", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "window_too_early" },
      }),
      row({
        id: "b",
        referenceCampaignPostId: "p2",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "stale_organic" },
      }),
    ]);
    expect(s).toEqual({
      referencedOrganicCount: 2,
      comparableCount: 0,
      effectiveCount: 0,
      inefficientCount: 0,
      notReadyCount: 2,
      nonComparableReasonCounts: {
        window_too_early: 1,
        stale_organic: 1,
      },
      explainabilityStatus: "insufficient_comparable_rows",
      explainabilityStatusText: INSUFFICIENT_ROWS_TEXT,
    });
    expect(s?.topStatusLabel).toBeUndefined();
    expect(s?.dominantNonComparableReason).toBeUndefined();
    expect(s?.dominantNonComparableReasonText).toBeUndefined();
    expect(s?.topStatusLabelText).toBeUndefined();
  });

  it("labels mixed when both effective and inefficient rows exist", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      }),
      row({
        id: "b",
        referenceCampaignPostId: "p2",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: false,
          paidUnderperformingOrganic: true,
          promotionEffective: false,
          promotionInefficient: true,
        },
      }),
    ]);
    expect(s).toEqual({
      referencedOrganicCount: 2,
      comparableCount: 2,
      effectiveCount: 1,
      inefficientCount: 1,
      notReadyCount: 0,
      topStatusLabel: "mixed",
      topStatusLabelText: promotionDecisionTopStatusLabelText("mixed"),
      explainabilityStatus: "ready",
    });
  });

  it("omits topStatusLabel when comparable but no outcome flags", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: false,
          paidUnderperformingOrganic: false,
          promotionEffective: false,
          promotionInefficient: false,
        },
      }),
    ]);
    expect(s).toEqual({
      referencedOrganicCount: 1,
      comparableCount: 1,
      effectiveCount: 0,
      inefficientCount: 0,
      notReadyCount: 0,
      explainabilityStatus: "insufficient_comparable_rows",
      explainabilityStatusText: INSUFFICIENT_ROWS_TEXT,
    });
    expect(s?.topStatusLabel).toBeUndefined();
    expect(s?.topStatusLabelText).toBeUndefined();
  });

  it("treats missing readiness on organic-linked row as not ready; Part 64 omits topStatusLabel", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
      }),
    ]);
    expect(s?.notReadyCount).toBe(1);
    expect(s?.comparableCount).toBe(0);
    expect(s?.topStatusLabel).toBeUndefined();
    expect(s?.explainabilityStatus).toBe("insufficient_comparable_rows");
    expect(s?.explainabilityStatusText).toBe(INSUFFICIENT_ROWS_TEXT);
    expect(s?.dominantNonComparableReason).toBeUndefined();
    expect(s?.dominantNonComparableReasonText).toBeUndefined();
  });

  it("Part 64: omits topStatusLabel when only one comparable row even if effective", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      }),
    ]);
    expect(s?.referencedOrganicCount).toBe(1);
    expect(s?.comparableCount).toBe(1);
    expect(s?.effectiveCount).toBe(1);
    expect(s?.topStatusLabel).toBeUndefined();
    expect(s?.explainabilityStatus).toBe("insufficient_comparable_rows");
    expect(s?.explainabilityStatusText).toBe(INSUFFICIENT_ROWS_TEXT);
  });

  it("Part 64: topStatusLabel returns when at least two comparable rows (effective)", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      }),
      row({
        id: "b",
        referenceCampaignPostId: "p2",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: false,
          paidUnderperformingOrganic: false,
          promotionEffective: false,
          promotionInefficient: false,
        },
      }),
    ]);
    expect(s?.comparableCount).toBe(2);
    expect(s?.topStatusLabel).toBe("promotion_effective");
    expect(s?.topStatusLabelText).toBe(promotionDecisionTopStatusLabelText("promotion_effective"));
    expect(s?.explainabilityStatus).toBe("ready");
  });

  it("Part 65: aggregates nonComparableReasonCounts by reason", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "insufficient_sample" },
      }),
      row({
        id: "b",
        referenceCampaignPostId: "p2",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "insufficient_sample" },
      }),
      row({
        id: "c",
        referenceCampaignPostId: "p3",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "insufficient_overlap" },
      }),
    ]);
    expect(s?.nonComparableReasonCounts).toEqual({
      insufficient_sample: 2,
      insufficient_overlap: 1,
    });
    expect(s?.explainabilityStatus).toBe("insufficient_comparable_rows");
    expect(s?.explainabilityStatusText).toBe(INSUFFICIENT_ROWS_TEXT);
    expect(s?.dominantNonComparableReason).toBe("insufficient_sample");
    expect(s?.dominantNonComparableReasonText).toBe(
      promotionDecisionDominantReasonText("insufficient_sample")
    );
  });

  it("Part 65: omits nonComparableReasonCounts when all organic-linked rows are comparable", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: true },
      }),
    ]);
    expect(s?.nonComparableReasonCounts).toBeUndefined();
    expect(s?.explainabilityStatus).toBe("insufficient_comparable_rows");
    expect(s?.explainabilityStatusText).toBe(INSUFFICIENT_ROWS_TEXT);
  });

  it("Part 65: omits nonComparableReasonCounts when non-comparable rows have no reason", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({ id: "a", referenceCampaignPostId: "p1", crossSurfaceComparisonReadiness: { comparable: false } }),
    ]);
    expect(s?.notReadyCount).toBe(1);
    expect(s?.nonComparableReasonCounts).toBeUndefined();
    expect(s?.explainabilityStatus).toBe("insufficient_comparable_rows");
    expect(s?.explainabilityStatusText).toBe(INSUFFICIENT_ROWS_TEXT);
  });

  it("Part 65: topStatusLabel still omitted with reasons present when comparableCount < 2", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: true,
          paidUnderperformingOrganic: false,
          promotionEffective: true,
          promotionInefficient: false,
        },
      }),
      row({
        id: "b",
        referenceCampaignPostId: "p2",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "window_too_early" },
      }),
    ]);
    expect(s?.comparableCount).toBe(1);
    expect(s?.effectiveCount).toBe(1);
    expect(s?.nonComparableReasonCounts).toEqual({ window_too_early: 1 });
    expect(s?.topStatusLabel).toBeUndefined();
    expect(s?.explainabilityStatus).toBe("insufficient_comparable_rows");
    expect(s?.explainabilityStatusText).toBe(INSUFFICIENT_ROWS_TEXT);
    expect(s?.dominantNonComparableReason).toBe("window_too_early");
    expect(s?.dominantNonComparableReasonText).toBe(
      promotionDecisionDominantReasonText("window_too_early")
    );
  });

  it("Part 66: omits explainabilityStatus when ≥2 comparable but no topStatusLabel", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: false,
          paidUnderperformingOrganic: false,
          promotionEffective: false,
          promotionInefficient: false,
        },
      }),
      row({
        id: "b",
        referenceCampaignPostId: "p2",
        crossSurfaceComparisonReadiness: { comparable: true },
        crossSurfacePromotionOutcomes: {
          paidOutperformingOrganic: false,
          paidUnderperformingOrganic: false,
          promotionEffective: false,
          promotionInefficient: false,
        },
      }),
    ]);
    expect(s?.referencedOrganicCount).toBe(2);
    expect(s?.comparableCount).toBe(2);
    expect(s?.topStatusLabel).toBeUndefined();
    expect(s?.explainabilityStatus).toBeUndefined();
    expect(s?.explainabilityStatusText).toBeUndefined();
  });

  it("Part 66: dominantNonComparableReason omitted when counts tie at max", () => {
    const s = computePromotionDecisionSummaryForCampaign([
      row({
        id: "a",
        referenceCampaignPostId: "p1",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "stale_paid" },
      }),
      row({
        id: "b",
        referenceCampaignPostId: "p2",
        crossSurfaceComparisonReadiness: { comparable: false, reason: "stale_organic" },
      }),
    ]);
    expect(s?.nonComparableReasonCounts).toEqual({ stale_paid: 1, stale_organic: 1 });
    expect(s?.dominantNonComparableReason).toBeUndefined();
    expect(s?.dominantNonComparableReasonText).toBeUndefined();
    expect(s?.explainabilityStatus).toBe("insufficient_comparable_rows");
    expect(s?.explainabilityStatusText).toBe(INSUFFICIENT_ROWS_TEXT);
  });
});

describe("promotion decision Part 67 label helpers", () => {
  it("promotionDecisionTopStatusLabelText maps legacy comparison_not_ready", () => {
    expect(promotionDecisionTopStatusLabelText("comparison_not_ready")).toBe(
      "Promotion comparisons are not ready yet"
    );
  });

  it("promotionDecisionDominantReasonText maps every readiness reason", () => {
    expect(promotionDecisionDominantReasonText("missing_timestamps")).toMatch(/missing comparison timestamps/);
    expect(promotionDecisionDominantReasonText("stale_organic")).toMatch(/fresher organic/);
    expect(promotionDecisionDominantReasonText("stale_paid")).toMatch(/fresher paid/);
    expect(promotionDecisionDominantReasonText("insufficient_overlap")).toMatch(/aligned comparison window/);
  });

  it("promotionDecisionExplainabilityStatusText only returns text for insufficient_comparable_rows", () => {
    expect(promotionDecisionExplainabilityStatusText("ready")).toBeUndefined();
    expect(promotionDecisionExplainabilityStatusText("insufficient_comparable_rows")).toBe(INSUFFICIENT_ROWS_TEXT);
    expect(promotionDecisionExplainabilityStatusText("no_linked_organic_drafts")).toBeUndefined();
  });
});
