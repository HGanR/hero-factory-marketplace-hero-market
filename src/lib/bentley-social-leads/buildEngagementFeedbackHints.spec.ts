import { hintsFromSummarySnapshot } from "./buildEngagementFeedbackHints";

describe("hintsFromSummarySnapshot", () => {
  it("returns angles from byLeadType / byPlatform", () => {
    const hints = hintsFromSummarySnapshot(
      {
        byLeadType: { local_service: 5, b2b_saas: 2 },
        byPlatform: { instagram: 4, tiktok: 1 },
      },
      { runId: "r1", uploadId: "u1" }
    );
    expect(hints.topPainSignals.length).toBeGreaterThan(0);
    expect(hints.suggestedContentAngles.length).toBeGreaterThan(0);
    expect(hints.runId).toBe("r1");
  });

  it("handles empty summary", () => {
    const hints = hintsFromSummarySnapshot(null);
    expect(hints.suggestedContentAngles.length).toBeGreaterThan(0);
  });
});
