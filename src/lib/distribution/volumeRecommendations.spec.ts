import { buildVolumeRecommendations } from "./volumeRecommendations";

describe("buildVolumeRecommendations", () => {
  it("suggests higher volume when funnel is strong", () => {
    const r = buildVolumeRecommendations({
      bookedRate: 0.1,
      closeRate: 0.05,
      trackedLeadCount: 25,
      postedDeploymentsLast30d: 4,
      winningPlatformHint: "tiktok",
    });
    expect(r.postsPerWeekSuggested.max).toBeGreaterThanOrEqual(4);
    expect(r.platformFocus.join(" ")).toMatch(/tiktok/i);
  });
});
