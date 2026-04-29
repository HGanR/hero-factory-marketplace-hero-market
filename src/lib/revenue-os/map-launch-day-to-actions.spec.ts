import { buildSevenDayLaunchPlan } from "./build-seven-day-launch-plan";
import {
  getLaunchDayScrollTargetForBentley,
  LAUNCH_SCROLL_IDS,
  mapLaunchDayToActions,
  summarizeLaunchDayActionsForDebug,
} from "./map-launch-day-to-actions";
import type { RevenueOsLaunchSharedProfile } from "./launch-mode-types";

const sharedProfile: RevenueOsLaunchSharedProfile = {
  businessName: "Co",
  coreOffer: "Offer text long enough here",
  transformation: "Transform",
  targetAudience: "Audience segment here",
  industry: "SaaS",
  postingPlatforms: ["Instagram"],
};

function dayStub(n: 1 | 2 | 3 | 4 | 5 | 6 | 7) {
  return {
    day: n,
    title: `Day ${n}`,
    objective: "obj",
    tasks: [],
    deliverables: [],
  };
}

describe("mapLaunchDayToActions", () => {
  it("ready plan: Day 3 includes content engine scroll and suggest_generate_content", () => {
    const launchPlan = buildSevenDayLaunchPlan({
      systemSignals: {
        opportunityScore: 70,
        offerStrengthScore: 65,
        trafficReadinessScore: 62,
        executionGapScore: 50,
      },
      sharedProfile,
    });
    const d = launchPlan.days.find((x) => x.day === 3)!;
    const actions = mapLaunchDayToActions({ dayPlan: d, launchPlan, sharedProfile });
    const kinds = actions.map((a) => a.kind);
    expect(kinds).toContain("scroll_to");
    expect(actions.some((a) => a.kind === "scroll_to" && a.targetId === LAUNCH_SCROLL_IDS.contentEngine)).toBe(true);
    expect(kinds).toContain("suggest_generate_content");
  });

  it("weak plan: Day 1 prepends review blockers scroll", () => {
    const thin = { ...sharedProfile, businessName: "", coreOffer: "", targetAudience: "" };
    const launchPlan = buildSevenDayLaunchPlan({
      systemSignals: { opportunityScore: 20 },
      sharedProfile: thin,
    });
    const d = launchPlan.days.find((x) => x.day === 1)!;
    const actions = mapLaunchDayToActions({ dayPlan: d, launchPlan, sharedProfile: thin });
    expect(actions[0]?.kind).toBe("scroll_to");
    if (actions[0]?.kind === "scroll_to") {
      expect(actions[0].targetId).toBe(LAUNCH_SCROLL_IDS.sevenDayLaunch);
    }
  });

  it("Day 5 maps distribution scroll before content engine", () => {
    const launchPlan = buildSevenDayLaunchPlan({
      systemSignals: {
        opportunityScore: 70,
        offerStrengthScore: 65,
        trafficReadinessScore: 62,
        executionGapScore: 50,
      },
      sharedProfile,
    });
    const d = launchPlan.days.find((x) => x.day === 5)!;
    const actions = mapLaunchDayToActions({ dayPlan: d, launchPlan, sharedProfile });
    const scrolls = actions.filter((a): a is { kind: "scroll_to"; targetId: string; label: string } => a.kind === "scroll_to");
    expect(scrolls.map((s) => s.targetId)).toContain(LAUNCH_SCROLL_IDS.distributionVolume);
    const distIdx = scrolls.findIndex((s) => s.targetId === LAUNCH_SCROLL_IDS.distributionVolume);
    const ceIdx = scrolls.findIndex((s) => s.targetId === LAUNCH_SCROLL_IDS.contentEngine);
    expect(distIdx).toBeLessThan(ceIdx);
  });

  it("summarizeLaunchDayActionsForDebug lists kinds and prefill availability", () => {
    const launchPlan = buildSevenDayLaunchPlan({
      systemSignals: {
        opportunityScore: 70,
        offerStrengthScore: 65,
        trafficReadinessScore: 62,
        executionGapScore: 50,
      },
      sharedProfile,
    });
    const d2 = launchPlan.days.find((x) => x.day === 2)!;
    const actions = mapLaunchDayToActions({ dayPlan: d2, launchPlan, sharedProfile });
    const sm = summarizeLaunchDayActionsForDebug(actions);
    expect(sm.kinds).toContain("prefill_campaign_notes");
    expect(sm.prefillAvailable.campaignNotes).toBe(true);
  });
});

describe("getLaunchDayScrollTargetForBentley", () => {
  it("prefers content-engine for Day 3", () => {
    const launchPlan = buildSevenDayLaunchPlan({
      systemSignals: {
        opportunityScore: 70,
        offerStrengthScore: 65,
        trafficReadinessScore: 62,
        executionGapScore: 50,
      },
      sharedProfile,
    });
    const d = launchPlan.days.find((x) => x.day === 3)!;
    const id = getLaunchDayScrollTargetForBentley({
      day: 3,
      dayPlan: d,
      launchPlan,
      sharedProfile,
    });
    expect(id).toBe(LAUNCH_SCROLL_IDS.contentEngine);
  });

  it("uses distribution volume for Day 5", () => {
    const launchPlan = buildSevenDayLaunchPlan({
      systemSignals: {
        opportunityScore: 70,
        offerStrengthScore: 65,
        trafficReadinessScore: 62,
        executionGapScore: 50,
      },
      sharedProfile,
    });
    const d = launchPlan.days.find((x) => x.day === 5)!;
    const id = getLaunchDayScrollTargetForBentley({
      day: 5,
      dayPlan: d,
      launchPlan,
      sharedProfile,
    });
    expect(id).toBe(LAUNCH_SCROLL_IDS.distributionVolume);
  });

  it("falls back when day missing from plan", () => {
    const launchPlan = buildSevenDayLaunchPlan({
      systemSignals: {},
      sharedProfile,
    });
    const id = getLaunchDayScrollTargetForBentley({
      day: 3,
      dayPlan: dayStub(3),
      launchPlan,
      sharedProfile,
    });
    expect(id).toBe(LAUNCH_SCROLL_IDS.contentEngine);
  });
});
