import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";
import { mergePolicyWorkbenchGuidanceIntoGrowthGuidance } from "@/lib/revenue-os/policy-workbench-guidance";
import {
  hasWorkbenchScenarioGuidanceSummaryLines,
  workbenchScenarioGuidanceLinesForUi,
} from "@/lib/revenue-os/policy-workbench-guidance-ui";

const baseGg: GrowthGuidance = {
  recommendedNextMove: "x",
  why: "y",
  risingTopics: [],
  weakAngles: [],
  bestHookDirection: "z",
};

describe("workbenchScenarioGuidanceLinesForUi", () => {
  it("returns all three lines when present", () => {
    const gg: GrowthGuidance = {
      ...baseGg,
      bentleyScenarioCompareSummaryLine: "Balanced scenario reduces approvals by 18% with low incremental risk.",
      bentleyScenarioPresetRecommendationLine: "Try the Balanced preset paired with baseline.",
      bentleyApplyReviewSummaryLine: "Notification changes are ready for reviewed apply.",
    };
    const lines = workbenchScenarioGuidanceLinesForUi(gg);
    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.key)).toEqual(["compare", "preset", "apply"]);
    expect(hasWorkbenchScenarioGuidanceSummaryLines(gg)).toBe(true);
  });

  it("returns one line when only one is present", () => {
    const gg: GrowthGuidance = {
      ...baseGg,
      bentleyScenarioPresetRecommendationLine: "Only preset copy.",
    };
    const lines = workbenchScenarioGuidanceLinesForUi(gg);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.key).toBe("preset");
    expect(hasWorkbenchScenarioGuidanceSummaryLines(gg)).toBe(true);
  });

  it("returns empty when none of the three are present", () => {
    expect(workbenchScenarioGuidanceLinesForUi(null)).toEqual([]);
    expect(workbenchScenarioGuidanceLinesForUi(undefined)).toEqual([]);
    expect(workbenchScenarioGuidanceLinesForUi(baseGg)).toEqual([]);
    expect(hasWorkbenchScenarioGuidanceSummaryLines(baseGg)).toBe(false);
  });

  it("ignores whitespace-only strings", () => {
    const gg: GrowthGuidance = {
      ...baseGg,
      bentleyScenarioCompareSummaryLine: "   ",
      bentleyScenarioPresetRecommendationLine: "Real",
    };
    expect(workbenchScenarioGuidanceLinesForUi(gg)).toHaveLength(1);
  });
});

describe("mergePolicyWorkbenchGuidanceIntoGrowthGuidance", () => {
  it("merges workbench payload into existing growth guidance", () => {
    const base: GrowthGuidance = { ...baseGg, bentleyPolicyWorkbenchSummaryLine: "from sweep" };
    const merged = mergePolicyWorkbenchGuidanceIntoGrowthGuidance(base, {
      bentleyScenarioCompareSummaryLine: "from db",
      bentleyPolicyWorkbenchSummaryLine: "from pw",
    });
    expect(merged?.bentleyPolicyWorkbenchSummaryLine).toBe("from pw");
    expect(merged?.bentleyScenarioCompareSummaryLine).toBe("from db");
  });

  it("returns null when base and pw are both empty", () => {
    expect(mergePolicyWorkbenchGuidanceIntoGrowthGuidance(null, {})).toBeNull();
  });
});
