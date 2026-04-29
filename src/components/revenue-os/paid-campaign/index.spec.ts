/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import * as paidCampaignClient from "./index";

describe("paid-campaign client barrel (Part 82 smoke)", () => {
  it("exports expected hydration helpers", () => {
    expect(typeof paidCampaignClient.readPromotionDecisionSummaryFromPaidJson).toBe("function");
    expect(typeof paidCampaignClient.parsePaidCampaignHydrationFromJson).toBe("function");
    expect(typeof paidCampaignClient.buildPlannerPaidCampaignHydrationFromJson).toBe("function");
  });
});
