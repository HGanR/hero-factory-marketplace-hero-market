import { normalizeLaunchCycleFromDbRows } from "./launch-progress-db";

describe("normalizeLaunchCycleFromDbRows", () => {
  it("maps rows to client progress with seven days", () => {
    const cycle = {
      id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      userId: "1",
      clientId: "",
      trustId: "",
      scopeKey: "revenue-os:launch-cycle-progress-v1",
      clientCycleRef: "lc-old",
      launchPlanSummary: "Plan sum",
      readinessJson: { isReady: false, blockerCount: 2 },
      planJson: null,
      signalsSnapshotJson: null,
      trackingSnapshotJson: { signalMaterialKey: "k", coreOfferNorm: "o", audienceNorm: "a" },
      currentDay: 3,
      createdAt: new Date("2021-01-01T00:00:00.000Z"),
      updatedAt: new Date("2021-01-02T00:00:00.000Z"),
      completedAt: null,
    };
    const dayRows = [
      {
        id: "d1",
        launchCycleId: cycle.id,
        dayNumber: 1,
        status: "completed",
        completedActionsJson: ["a", "b"],
        notesText: "n1",
        lastActionAt: new Date("2021-01-02T01:00:00.000Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const p = normalizeLaunchCycleFromDbRows(cycle as never, dayRows as never);
    expect(p.cycleId).toBe(cycle.id);
    expect(p.serverCycleId).toBe(cycle.id);
    expect(p.currentDay).toBe(3);
    expect(p.days[0]!.status).toBe("completed");
    expect(p.days[0]!.completedActions).toEqual(["a", "b"]);
    expect(p.days[1]!.status).toBe("not_started");
    expect(p.trackingSnapshot?.signalMaterialKey).toBe("k");
  });
});
