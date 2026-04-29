import { summarizeLaunchCycleAnalytics, summarizeLaunchHistoryAnalytics } from "./launch-analytics-summary";
import type { RevenueOsLaunchCycleProgress } from "./launch-progress-types";

function base(): RevenueOsLaunchCycleProgress {
  const days = ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => ({
    day,
    status: "not_started" as const,
    completedActions: [] as string[],
  }));
  return {
    cycleId: "c",
    createdAt: "t",
    updatedAt: "t",
    launchPlanSummary: "Old summary",
    readinessAtCreation: { isReady: true, blockerCount: 0 },
    days,
    currentDay: 1,
  };
}

describe("summarizeLaunchCycleAnalytics", () => {
  it("counts blocked days", () => {
    const p = base();
    p.days[1]!.status = "blocked";
    p.days[3]!.status = "blocked";
    const s = summarizeLaunchCycleAnalytics(p);
    expect(s.blockedDayCount).toBe(2);
  });

  it("flags stale plan when live summary differs", () => {
    const p = base();
    const s = summarizeLaunchCycleAnalytics(p, { livePlanSummary: "New summary text" });
    expect(s.stalePlan).toBe(true);
  });
});

describe("summarizeLaunchHistoryAnalytics", () => {
  it("returns empty note when no cycles", () => {
    const h = summarizeLaunchHistoryAnalytics([]);
    expect(h.cyclesReviewed).toBe(0);
    expect(h.note).toMatch(/No prior/i);
  });
});
