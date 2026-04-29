import { humanizeMissingFieldsForFullAnalysis } from "./bentley-dashboard-handoff";

describe("humanizeMissingFieldsForFullAnalysis", () => {
  it("maps common Zod profile paths to readable labels", () => {
    const out = humanizeMissingFieldsForFullAnalysis([
      "profile.currentMonthlyRevenue: Invalid",
      "profile.cac: Invalid",
    ]);
    expect(out[0]).toMatch(/current monthly revenue/i);
    expect(out[1]).toMatch(/cac/i);
  });
});
