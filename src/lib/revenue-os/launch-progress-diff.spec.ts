import { diffLaunchProgressAgainstCurrent } from "./launch-progress-diff";
import type { RevenueOsLaunchCycleProgress } from "./launch-progress-types";
import { systemSignalsMaterialKey } from "./bentley-system-signal-diagnostics";

const shared = {
  businessName: "B",
  coreOffer: "Offer one",
  transformation: "",
  targetAudience: "Audience one",
  industry: "I",
  postingPlatforms: [] as string[],
};

function cycle(overrides?: Partial<RevenueOsLaunchCycleProgress>): RevenueOsLaunchCycleProgress {
  const days = ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => ({
    day,
    status: "not_started" as const,
    completedActions: [] as string[],
  }));
  return {
    cycleId: "c",
    createdAt: "t",
    updatedAt: "t",
    launchPlanSummary: "Original summary text",
    readinessAtCreation: { isReady: true, blockerCount: 0 },
    days,
    currentDay: 1,
    trackingSnapshot: {
      signalMaterialKey: systemSignalsMaterialKey({
        opportunityScore: 50,
        offerStrengthScore: 50,
        trafficReadinessScore: 50,
        executionGapScore: 50,
      }),
      coreOfferNorm: "Offer one",
      audienceNorm: "Audience one",
    },
    ...overrides,
  };
}

describe("launch-progress-diff", () => {
  it("flags stale when launch plan summary changed", () => {
    const c = cycle();
    const d = diffLaunchProgressAgainstCurrent({
      cycle: c,
      currentPlanSummary: "Different summary entirely",
      currentReadiness: { isReady: true, blockerCount: 0 },
      systemSignals: { opportunityScore: 50, offerStrengthScore: 50, trafficReadinessScore: 50, executionGapScore: 50 },
      sharedProfile: shared,
    });
    expect(d.hasMeaningfulChange).toBe(true);
    expect(d.reasons.some((r) => /summary changed/i.test(r))).toBe(true);
  });

  it("is quiet when snapshot still matches", () => {
    const c = cycle();
    const d = diffLaunchProgressAgainstCurrent({
      cycle: c,
      currentPlanSummary: c.launchPlanSummary,
      currentReadiness: { isReady: true, blockerCount: 0 },
      systemSignals: { opportunityScore: 50, offerStrengthScore: 50, trafficReadinessScore: 50, executionGapScore: 50 },
      sharedProfile: shared,
    });
    expect(d.hasMeaningfulChange).toBe(false);
    expect(d.reasons).toHaveLength(0);
  });
});
