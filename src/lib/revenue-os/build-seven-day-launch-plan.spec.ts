import {
  buildSevenDayLaunchPlan,
  computeLaunchModeReadiness,
  getLaunchReadinessContributorForDebug,
} from "./build-seven-day-launch-plan";
import { defaultWorkflowState } from "./bentley-workflow";

const baseProfile = {
  businessName: "Acme Co",
  coreOffer: "We help founders launch in 30 days with done-for-you creative.",
  transformation: "From idea chaos to a live GTM in one month.",
  targetAudience: "Bootstrapped SaaS founders doing their own marketing.",
  industry: "B2B SaaS",
  postingPlatforms: ["Instagram", "LinkedIn"],
};

describe("buildSevenDayLaunchPlan", () => {
  it("returns 7 days and ready readiness when scores + intake are in band", () => {
    const plan = buildSevenDayLaunchPlan({
      systemSignals: {
        opportunityScore: 70,
        offerStrengthScore: 65,
        trafficReadinessScore: 62,
        executionGapScore: 50,
      },
      sharedProfile: baseProfile,
      workflowState: defaultWorkflowState(),
    });
    expect(plan.days).toHaveLength(7);
    expect(plan.readiness.isReady).toBe(true);
    expect(plan.readiness.blockers.length).toBe(0);
    expect(plan.summary).toMatch(/Acme Co/);
    expect(plan.days[0]!.day).toBe(1);
    expect(plan.days[6]!.day).toBe(7);
  });

  it("marks not ready when offer score is weak despite strong opportunity", () => {
    const plan = buildSevenDayLaunchPlan({
      systemSignals: {
        opportunityScore: 80,
        offerStrengthScore: 40,
        trafficReadinessScore: 65,
        executionGapScore: 45,
      },
      sharedProfile: baseProfile,
      workflowState: defaultWorkflowState(),
    });
    expect(plan.readiness.isReady).toBe(false);
    expect(plan.readiness.blockers.some((b) => /offer clarity/i.test(b))).toBe(true);
    expect(plan.days).toHaveLength(7);
  });

  it("flags high execution gap even when traffic looks strong", () => {
    const plan = buildSevenDayLaunchPlan({
      systemSignals: {
        opportunityScore: 70,
        offerStrengthScore: 65,
        trafficReadinessScore: 75,
        executionGapScore: 72,
      },
      sharedProfile: baseProfile,
      workflowState: defaultWorkflowState(),
    });
    expect(plan.readiness.isReady).toBe(false);
    expect(plan.readiness.blockers.some((b) => /execution gap/i.test(b))).toBe(true);
  });

  it("still builds a plan with blockers when inputs are mostly empty", () => {
    const plan = buildSevenDayLaunchPlan({
      systemSignals: {},
      sharedProfile: {
        businessName: "",
        coreOffer: "",
        transformation: "",
        targetAudience: "",
        industry: "",
        postingPlatforms: [],
      },
      workflowState: defaultWorkflowState(),
    });
    expect(plan.days).toHaveLength(7);
    expect(plan.readiness.isReady).toBe(false);
    expect(plan.readiness.blockers.length).toBeGreaterThan(3);
  });
});

describe("computeLaunchModeReadiness", () => {
  it("lists missing scores as blockers", () => {
    const r = computeLaunchModeReadiness({}, baseProfile);
    expect(r.isReady).toBe(false);
    expect(r.blockers.some((b) => /Opportunity score not available/i.test(b))).toBe(true);
  });
});

describe("getLaunchReadinessContributorForDebug", () => {
  it("returns strength role when ready", () => {
    const signals = {
      opportunityScore: 70,
      offerStrengthScore: 65,
      trafficReadinessScore: 62,
      executionGapScore: 50,
    };
    const readiness = computeLaunchModeReadiness(signals, baseProfile);
    const c = getLaunchReadinessContributorForDebug(signals, readiness);
    expect(readiness.isReady).toBe(true);
    expect(c.role).toBe("strength");
    expect(c.system).not.toBeNull();
  });

  it("returns limiter role when not ready", () => {
    const signals = { opportunityScore: 30, offerStrengthScore: 30 };
    const readiness = computeLaunchModeReadiness(signals, baseProfile);
    const c = getLaunchReadinessContributorForDebug(signals, readiness);
    expect(readiness.isReady).toBe(false);
    expect(c.role).toBe("limiter");
  });
});
