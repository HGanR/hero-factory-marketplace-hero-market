import type { RevenueOsLaunchCycleProgress } from "./launch-progress-types";
import {
  advanceLaunchCurrentDayIfReady,
  markLaunchDayActionCompleted,
  setLaunchDayStatus,
} from "./launch-progress-actions";

function baseProgress(overrides?: Partial<RevenueOsLaunchCycleProgress>): RevenueOsLaunchCycleProgress {
  const days = ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => ({
    day,
    status: "not_started" as const,
    completedActions: [] as string[],
  }));
  return {
    cycleId: "c-test",
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    launchPlanSummary: "Summary",
    readinessAtCreation: { isReady: true, blockerCount: 0 },
    days,
    currentDay: 1,
    ...overrides,
  };
}

describe("launch-progress-actions", () => {
  it("markLaunchDayActionCompleted leaves day in_progress without completing", () => {
    let p = baseProgress();
    p = markLaunchDayActionCompleted(p, 1, "did a thing");
    const d1 = p.days.find((x) => x.day === 1)!;
    expect(d1.status).toBe("in_progress");
    expect(d1.completedActions).toContain("did a thing");
    expect(p.currentDay).toBe(1);
  });

  it("completing a day advances currentDay to the next incomplete day", () => {
    let p = baseProgress();
    p = setLaunchDayStatus(p, 1, "completed");
    expect(p.currentDay).toBe(2);
    const d1 = p.days.find((x) => x.day === 1)!;
    expect(d1.status).toBe("completed");
  });

  it("blocked day does not auto-advance currentDay", () => {
    let p = baseProgress({ currentDay: 2 });
    p = setLaunchDayStatus(p, 2, "blocked");
    expect(p.currentDay).toBe(2);
    expect(p.days.find((x) => x.day === 2)!.status).toBe("blocked");
  });

  it("advanceLaunchCurrentDayIfReady jumps to first incomplete when already past completed streak", () => {
    let p = baseProgress({ currentDay: 1 });
    p = setLaunchDayStatus(p, 1, "completed");
    p = { ...p, currentDay: 1 };
    const fixed = advanceLaunchCurrentDayIfReady(p);
    expect(fixed.currentDay).toBe(2);
  });
});
