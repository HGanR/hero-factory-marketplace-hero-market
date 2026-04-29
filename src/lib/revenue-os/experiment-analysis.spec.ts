import { analyzeExperimentPerformance } from "./experiment-analysis";

describe("analyzeExperimentPerformance", () => {
  it("handles empty summary", () => {
    const a = analyzeExperimentPerformance(null);
    expect(a.winningVariants).toEqual([]);
    expect(a.confidenceNote).toMatch(/No variant/i);
  });

  it("ranks winners when enough signal", () => {
    const a = analyzeExperimentPerformance({
      experimentTheme: "test",
      variants: [
        { variantKey: "A", hookType: "pov", angle: "a1", ctaType: "save", score: 100, views: 10, leads: 1 },
        { variantKey: "B", hookType: "list", angle: "a2", ctaType: "link", score: 10, views: 2, leads: 0 },
      ],
    });
    expect(a.winningVariants).toContain("A");
    expect(a.recommendedNextPromotion.length).toBeGreaterThan(5);
  });
});
