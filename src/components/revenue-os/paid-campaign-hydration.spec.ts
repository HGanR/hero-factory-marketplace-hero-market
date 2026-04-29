import { describe, it, expect } from "@jest/globals";
import type { PromotionDecisionSummary } from "@/lib/social/paid-social-campaigns";
import {
  buildPlannerPaidCampaignHydrationFromJson,
  parsePaidCampaignHydrationFromJson,
  readPromotionDecisionSummaryFromPaidJson,
  type PaidCampaignHydration,
} from "./paid-campaign-hydration";

const summary: PromotionDecisionSummary = {
  referencedOrganicCount: 1,
  comparableCount: 1,
  effectiveCount: 0,
  inefficientCount: 0,
  notReadyCount: 0,
};

const paid = { id: "pc-1", name: "Draft" };

describe("readPromotionDecisionSummaryFromPaidJson", () => {
  it("returns null when promotionDecisionSummary key is omitted", () => {
    expect(readPromotionDecisionSummaryFromPaidJson({})).toBeNull();
    expect(readPromotionDecisionSummaryFromPaidJson({ paidCampaign: paid })).toBeNull();
  });

  it("returns summary when present", () => {
    expect(readPromotionDecisionSummaryFromPaidJson({ promotionDecisionSummary: summary })).toEqual(summary);
  });
});

describe("parsePaidCampaignHydrationFromJson (PaidCampaignHydration)", () => {
  it("returns paidCampaign and promotionDecisionSummary when both are present", () => {
    const h: PaidCampaignHydration<typeof paid> = parsePaidCampaignHydrationFromJson({
      paidCampaign: paid,
      promotionDecisionSummary: summary,
    });
    expect(h.paidCampaign).toEqual(paid);
    expect(h.promotionDecisionSummary).toEqual(summary);
  });

  it("returns paidCampaign and null summary when summary key is omitted", () => {
    const h = parsePaidCampaignHydrationFromJson({ paidCampaign: paid });
    expect(h.paidCampaign).toEqual(paid);
    expect(h.promotionDecisionSummary).toBeNull();
  });

  it("returns null paidCampaign when key is absent", () => {
    const h = parsePaidCampaignHydrationFromJson({ promotionDecisionSummary: summary });
    expect(h.paidCampaign).toBeNull();
    expect(h.promotionDecisionSummary).toEqual(summary);
  });

  it("returns null paidCampaign and null summary for empty object", () => {
    const h = parsePaidCampaignHydrationFromJson({});
    expect(h.paidCampaign).toBeNull();
    expect(h.promotionDecisionSummary).toBeNull();
  });
});

describe("buildPlannerPaidCampaignHydrationFromJson", () => {
  it("includes paidCampaign only when present", () => {
    const at = 1_700_000_000_000;
    const withPc = buildPlannerPaidCampaignHydrationFromJson(
      { paidCampaign: paid, promotionDecisionSummary: summary },
      at
    );
    expect(withPc).toEqual({
      at,
      paidCampaign: paid,
      promotionDecisionSummary: summary,
    });

    const noPc = buildPlannerPaidCampaignHydrationFromJson({ promotionDecisionSummary: summary }, at);
    expect(noPc).toEqual({ at, promotionDecisionSummary: summary });
    expect(Object.prototype.hasOwnProperty.call(noPc, "paidCampaign")).toBe(false);
  });
});
