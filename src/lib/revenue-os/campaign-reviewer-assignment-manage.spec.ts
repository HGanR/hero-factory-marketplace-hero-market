import { describe, it, expect } from "@jest/globals";
import { isCampaignReviewerManagementAllowed } from "@/lib/revenue-os/campaign-reviewer-assignment-manage";

describe("isCampaignReviewerManagementAllowed", () => {
  it("allows owner", () => {
    expect(isCampaignReviewerManagementAllowed("7", 7, false)).toBe(true);
    expect(isCampaignReviewerManagementAllowed("7", 8, false)).toBe(false);
  });

  it("allows admin session regardless of owner match", () => {
    expect(isCampaignReviewerManagementAllowed("99", 7, true)).toBe(true);
  });
});
