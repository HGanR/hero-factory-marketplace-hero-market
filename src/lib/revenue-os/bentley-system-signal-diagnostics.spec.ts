import {
  buildSystemSignalDiagnosticSummary,
  mapSystemSignalsToNextActions,
  shouldSuggestSevenDayLaunch,
  systemSignalsMaterialKey,
} from "./bentley-system-signal-diagnostics";

describe("buildSystemSignalDiagnosticSummary", () => {
  it("returns empty-state messaging when no scores exist", () => {
    const d = buildSystemSignalDiagnosticSummary({});
    expect(d.strongestSystem).toBeNull();
    expect(d.weakestSystem).toBeNull();
    expect(d.warnings).toEqual([]);
    expect(d.opportunities).toEqual([]);
    expect(d.summaryText).toMatch(/score your five systems/i);
  });

  it("picks strongest and weakest by comparable values (execution uses inverted gap)", () => {
    const d = buildSystemSignalDiagnosticSummary({
      opportunityScore: 70,
      offerStrengthScore: 30,
      trafficReadinessScore: 80,
      executionGapScore: 70,
      capitalReadinessScore: 50,
    });
    expect(d.strongestSystem).toBe("traffic");
    expect(d.weakestSystem).toBe("offer");
    expect(d.warnings.some((w) => /offer/i.test(w))).toBe(true);
    expect(d.warnings.some((w) => /execution gap/i.test(w))).toBe(true);
  });

  it("emits opportunities for strong layers", () => {
    const d = buildSystemSignalDiagnosticSummary({
      opportunityScore: 72,
      offerStrengthScore: 65,
      trafficReadinessScore: 62,
      executionGapScore: 35,
      capitalReadinessScore: 70,
    });
    expect(d.opportunities.length).toBeGreaterThan(0);
    expect(d.warnings.length).toBe(0);
  });
});

describe("mapSystemSignalsToNextActions", () => {
  it("routes low opportunity to step 3", () => {
    const n = mapSystemSignalsToNextActions({
      opportunityScore: 30,
      offerStrengthScore: 80,
    });
    expect(n.recommendedStep).toBe(3);
    expect(n.primaryAction).toMatch(/Step 3/i);
  });

  it("routes low offer before traffic when opportunity is ok", () => {
    const n = mapSystemSignalsToNextActions({
      opportunityScore: 60,
      offerStrengthScore: 20,
      trafficReadinessScore: 20,
    });
    expect(n.recommendedStep).toBe(4);
    expect(n.primaryAction).toMatch(/offer/i);
  });

  it("routes high execution gap with strong intake to step 4", () => {
    const n = mapSystemSignalsToNextActions({
      opportunityScore: 60,
      offerStrengthScore: 60,
      trafficReadinessScore: 50,
      executionGapScore: 70,
    });
    expect(n.recommendedStep).toBe(4);
    expect(n.primaryAction).toMatch(/Step 4/i);
  });

  it("routes high execution gap when opportunity score is missing to step 1", () => {
    const n = mapSystemSignalsToNextActions({
      offerStrengthScore: 60,
      trafficReadinessScore: 60,
      executionGapScore: 80,
    });
    expect(n.recommendedStep).toBe(1);
    expect(n.primaryAction).toMatch(/Step 1/i);
  });

  it("suggests launch posture when multiple layers are balanced", () => {
    const n = mapSystemSignalsToNextActions({
      opportunityScore: 55,
      offerStrengthScore: 55,
      trafficReadinessScore: 55,
      executionGapScore: 45,
      capitalReadinessScore: 40,
    });
    expect(n.recommendedStep).toBeNull();
    expect(n.primaryAction).toMatch(/launch/i);
  });
});

describe("shouldSuggestSevenDayLaunch", () => {
  it("is true only when all thresholds pass", () => {
    expect(
      shouldSuggestSevenDayLaunch({
        opportunityScore: 65,
        offerStrengthScore: 60,
        trafficReadinessScore: 60,
        executionGapScore: 55,
      })
    ).toBe(true);
    expect(
      shouldSuggestSevenDayLaunch({
        opportunityScore: 64,
        offerStrengthScore: 60,
        trafficReadinessScore: 60,
        executionGapScore: 55,
      })
    ).toBe(false);
  });
});

describe("systemSignalsMaterialKey", () => {
  it("changes only when a score field changes", () => {
    expect(systemSignalsMaterialKey({})).toBe("||||");
    expect(systemSignalsMaterialKey({ opportunityScore: 1 })).toBe("1||||");
    expect(systemSignalsMaterialKey({ opportunityScore: 1 })).toBe(
      systemSignalsMaterialKey({ opportunityScore: 1 })
    );
  });
});
