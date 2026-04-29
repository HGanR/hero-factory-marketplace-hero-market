import { computeNextAutomationRunAt, shouldRunAutomationPolicy } from "@/lib/revenue-os/automation-policy-helpers";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import { buildEmptyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { buildBentleyExecutiveReport } from "@/lib/revenue-os/executive-report";
import { mergeProactiveAutomationIntoGrowthGuidance } from "@/lib/revenue-os/proactive-automation-guidance";

describe("automation policy helpers", () => {
  it("computeNextAutomationRunAt advances from lastRunAt", () => {
    const last = new Date("2026-01-01T12:00:00.000Z");
    const next = computeNextAutomationRunAt({
      policyType: "daily_operator_summary",
      lastRunAt: last,
      scheduleJson: { intervalHours: 24 },
      nowMs: last.getTime(),
    });
    expect(next.getTime()).toBeGreaterThan(last.getTime());
  });

  it("shouldRunAutomationPolicy respects nextRunAt", () => {
    const past = new Date(Date.now() - 3600_000);
    expect(
      shouldRunAutomationPolicy({
        isEnabled: true,
        nextRunAt: past,
        lastRunAt: null,
        nowMs: Date.now(),
      })
    ).toBe(true);
    const future = new Date(Date.now() + 3600_000);
    expect(
      shouldRunAutomationPolicy({
        isEnabled: true,
        nextRunAt: future,
        lastRunAt: null,
        nowMs: Date.now(),
      })
    ).toBe(false);
  });
});

describe("detectBentleyExceptions", () => {
  it("returns safe summary for empty overview", () => {
    const o = buildEmptyOperatorOverview("u1");
    const r = detectBentleyExceptions({ overview: o });
    expect(r.exceptionSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(r.criticalExceptions)).toBe(true);
  });
});

describe("buildBentleyExecutiveReport", () => {
  it("builds report from precomputed overview without extra DB scope", async () => {
    const o = buildEmptyOperatorOverview("u1");
    const r = await buildBentleyExecutiveReport({
      userId: "u1",
      mode: "daily_operator_report",
      overview: o,
    });
    expect(r.headline.length).toBeGreaterThan(0);
    expect(r.exceptionSummary).toBeDefined();
  });
});

describe("mergeProactiveAutomationIntoGrowthGuidance", () => {
  it("adds proactive fields", () => {
    const g = mergeProactiveAutomationIntoGrowthGuidance(
      {
        recommendedNextMove: "x",
        why: "y",
        risingTopics: [],
        weakAngles: [],
        bestHookDirection: "z",
      },
      {
        criticalExceptionCount: 2,
        topEscalationLine: "Escalate",
        overdueAutomationSummary: "1 overdue",
      }
    );
    expect(g.bentleyCriticalExceptionCount).toBe(2);
    expect(g.bentleyTopEscalationLine).toContain("Escalate");
  });
});
