import { describe, it, expect } from "@jest/globals";
import { normalizeMetaPaidInsightsRow } from "@/lib/social/paid-social-analytics-normalize";

describe("normalizeMetaPaidInsightsRow", () => {
  it("parses string spend to minor units", () => {
    const n = normalizeMetaPaidInsightsRow({
      impressions: "1000",
      clicks: "12",
      spend: "34.56",
      reach: "800",
      cpc: "2.88",
      cpm: "3.45",
      ctr: "1.2",
    });
    expect(n.impressions).toBe(1000);
    expect(n.clicks).toBe(12);
    expect(n.spendMinor).toBe(3456);
    expect(n.reach).toBe(800);
    expect(n.cpcMinor).toBe(288);
    expect(n.cpmMinor).toBe(345);
    expect(n.ctr).toBe(1.2);
  });

  it("returns nulls for missing fields", () => {
    const n = normalizeMetaPaidInsightsRow({});
    expect(n.impressions).toBeNull();
    expect(n.spendMinor).toBeNull();
  });
});
