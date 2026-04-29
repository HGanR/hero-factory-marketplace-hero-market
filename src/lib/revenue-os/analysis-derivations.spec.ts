import { describe, expect, it } from "@jest/globals";
import {
  bentleyCompletionSummaryLine,
  computePrimaryFocusLever,
  firstPlanRecommendation,
} from "@/lib/revenue-os/analysis-derivations";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";

const sample: RevenueOsAnalyzeResponse = {
  kpis: {
    currentMonthlyRevenueModel: 10_000,
    targetMonthlyRevenue: 50_000,
    revenueGap: 40_000,
    impliedOrdersNeeded: 100,
  },
  levers: {
    traffic: { current: 1000, target: 1250, delta: 250 },
    conversionRatePct: { current: 2, target: 3, delta: 1 },
    avgOrderValue: { current: 500, target: 575, delta: 75 },
    cac: { current: 100, target: 85, delta: -15 },
  },
  plan: {
    offerEngineering: ["First offer tip"],
    funnel: [],
    sales: [],
    capitalAllocation: [],
    optimization: [],
  },
  projections: {
    base: { traffic: 1000, conversionRatePct: 2, avgOrderValue: 500, revenue: 10_000 },
    target: { traffic: 1250, conversionRatePct: 3, avgOrderValue: 575, revenue: 50_000 },
  },
  meta: { inputHash: "x", createdAt: "2026-01-01" },
};

describe("analysis-derivations", () => {
  it("exports functions callable from dashboard bundle", () => {
    expect(typeof bentleyCompletionSummaryLine).toBe("function");
    expect(typeof computePrimaryFocusLever).toBe("function");
    expect(typeof firstPlanRecommendation).toBe("function");
  });

  it("computePrimaryFocusLever returns key and name", () => {
    const f = computePrimaryFocusLever(sample);
    expect(["traffic", "conversionRatePct", "avgOrderValue", "cac"]).toContain(f.key);
    expect(f.name.length).toBeGreaterThan(2);
  });

  it("firstPlanRecommendation returns first plan string", () => {
    expect(firstPlanRecommendation(sample)).toBe("First offer tip");
  });

  it("bentleyCompletionSummaryLine returns non-empty string", () => {
    const line = bentleyCompletionSummaryLine(sample);
    expect(line.length).toBeGreaterThan(20);
    expect(line).toContain("gap");
  });
});
