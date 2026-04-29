import type { RevenueOsLaunchCycleProgress } from "./launch-progress-types";
import {
  launchProgressesMateriallyEqual,
  launchProgressMaterialFingerprint,
  reconcileLaunchCycleProgress,
} from "./launch-progress-sync";

function prog(partial: Partial<RevenueOsLaunchCycleProgress> & { day?: 1 }): RevenueOsLaunchCycleProgress {
  const days = ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => ({
    day,
    status: "not_started" as const,
    completedActions: [] as string[],
  }));
  return {
    cycleId: "local-1",
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-02T00:00:00.000Z",
    launchPlanSummary: "S",
    readinessAtCreation: { isReady: true, blockerCount: 0 },
    days,
    currentDay: 1,
    ...partial,
  };
}

describe("reconcileLaunchCycleProgress", () => {
  it("local only → merged local and should push", () => {
    const l = prog({});
    const r = reconcileLaunchCycleProgress(l, null);
    expect(r.merged?.cycleId).toBe("local-1");
    expect(r.winner).toBe("local");
    expect(r.shouldPushLocalToRemote).toBe(true);
  });

  it("remote only → merged remote and no push", () => {
    const rem = prog({ cycleId: "srv-uuid-1111-2222-3333-444455556666", updatedAt: "2020-01-01T00:00:00.000Z" });
    const r = reconcileLaunchCycleProgress(null, rem);
    expect(r.merged?.cycleId).toContain("srv-uuid");
    expect(r.winner).toBe("remote");
    expect(r.shouldPushLocalToRemote).toBe(false);
  });

  it("remote newer than local → remote wins", () => {
    const l = prog({ updatedAt: "2020-01-01T00:00:00.000Z" });
    const rem = prog({
      cycleId: "b2ee4f2e-1111-2222-3333-444455556666",
      updatedAt: "2020-02-01T00:00:00.000Z",
    });
    const r = reconcileLaunchCycleProgress(l, rem);
    expect(r.merged?.cycleId).toBe(rem.cycleId);
    expect(r.winner).toBe("remote");
    expect(r.shouldPushLocalToRemote).toBe(false);
  });

  it("local newer than remote → local wins and should push", () => {
    const l = prog({ updatedAt: "2020-03-01T00:00:00.000Z" });
    const rem = prog({
      cycleId: "b2ee4f2e-1111-2222-3333-444455556666",
      updatedAt: "2020-02-01T00:00:00.000Z",
    });
    const r = reconcileLaunchCycleProgress(l, rem);
    expect(r.merged?.cycleId).toBe("local-1");
    expect(r.winner).toBe("local");
    expect(r.shouldPushLocalToRemote).toBe(true);
  });

  it("same timestamps and equal content → tie, no push", () => {
    const l = prog({ updatedAt: "2020-01-05T00:00:00.000Z" });
    const rem = prog({
      cycleId: "b2ee4f2e-1111-2222-3333-444455556666",
      updatedAt: "2020-01-05T00:00:00.000Z",
    });
    const r = reconcileLaunchCycleProgress(l, rem);
    expect(r.winner).toBe("tie");
    expect(r.shouldPushLocalToRemote).toBe(false);
    expect(launchProgressMaterialFingerprint(r.merged!)).toBe(launchProgressMaterialFingerprint(rem));
  });

  it("same timestamps but different content → tie, prefer remote merged, no push", () => {
    const l = prog({ updatedAt: "2020-01-05T00:00:00.000Z", currentDay: 2 });
    const rem = prog({
      cycleId: "b2ee4f2e-1111-2222-3333-444455556666",
      updatedAt: "2020-01-05T00:00:00.000Z",
      currentDay: 1,
    });
    const r = reconcileLaunchCycleProgress(l, rem);
    expect(r.winner).toBe("tie");
    expect(r.shouldPushLocalToRemote).toBe(false);
    expect(r.merged?.currentDay).toBe(rem.currentDay);
  });
});

describe("launchProgressMaterialFingerprint", () => {
  it("matches when materially equal", () => {
    const a = prog({});
    const b = prog({ cycleId: "other-id" });
    expect(launchProgressesMateriallyEqual(a, b)).toBe(true);
  });
});
