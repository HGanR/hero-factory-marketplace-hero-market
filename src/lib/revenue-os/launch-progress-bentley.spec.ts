import { buildSevenDayLaunchPlan } from "./build-seven-day-launch-plan";
import { defaultWorkflowState } from "./bentley-workflow";
import { formatBentleyLaunchProgressReply } from "./launch-progress-bentley";

const sharedProfile = {
  businessName: "Co",
  coreOffer: "O",
  transformation: "",
  targetAudience: "A",
  industry: "I",
  postingPlatforms: [] as string[],
};

describe("launch-progress-bentley", () => {
  it("empty resume path explains no saved cycle without JSON dump", () => {
    const plan = buildSevenDayLaunchPlan({
      systemSignals: {},
      sharedProfile: sharedProfile,
      workflowState: defaultWorkflowState(),
    });
    const reply = formatBentleyLaunchProgressReply({
      progress: null,
      plan,
      sharedProfile,
      debug: false,
    });
    expect(reply).toMatch(/no saved cycle/i);
    expect(reply).not.toMatch(/"cycleId"/);
  });

  it("includes structured JSON only in debug mode", () => {
    const plan = buildSevenDayLaunchPlan({
      systemSignals: {},
      sharedProfile: sharedProfile,
      workflowState: defaultWorkflowState(),
    });
    const progress = {
      cycleId: "c1",
      createdAt: "t",
      updatedAt: "t",
      launchPlanSummary: "s",
      readinessAtCreation: { isReady: false, blockerCount: 2 },
      currentDay: 2 as const,
      days: ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => ({
        day,
        status: "not_started" as const,
        completedActions: [] as string[],
      })),
    };
    const normal = formatBentleyLaunchProgressReply({ progress, plan, sharedProfile, debug: false });
    expect(normal).not.toMatch(/```/);
    const dbg = formatBentleyLaunchProgressReply({ progress, plan, sharedProfile, debug: true });
    expect(dbg).toMatch(/```/);
    expect(dbg).toMatch(/"cycleId"/);
  });
});
