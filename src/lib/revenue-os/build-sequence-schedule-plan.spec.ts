import {
  ALL_CONTENT_BATCH_ROLES,
  emptyCountsByRole,
  type RevenueOsContentBatchRoutingSummary,
  type RevenueOsContentBatchRole,
  type RevenueOsRoutedContentItem,
} from "@/lib/revenue-os/content-batch-routing-types";
import { buildContentBatchCalendarSequence } from "@/lib/revenue-os/build-content-batch-calendar-sequence";
import { buildSequenceSchedulePlan } from "@/lib/revenue-os/build-sequence-schedule-plan";
import type {
  RevenueOsPlatformRole,
  RevenueOsPlatformRoleRoutingSummary,
} from "@/lib/revenue-os/platform-role-routing";

const FIXED_NOW = new Date("2025-03-10T18:00:00.000Z");

function makeBatch(partial: Partial<Record<RevenueOsContentBatchRole, number>>): RevenueOsContentBatchRoutingSummary {
  const counts = emptyCountsByRole();
  const items: RevenueOsRoutedContentItem[] = [];
  for (const role of ALL_CONTENT_BATCH_ROLES) {
    const n = partial[role] ?? 0;
    counts[role] = n;
    for (let i = 0; i < n; i++) {
      items.push({
        id: `${role}-${i}`,
        source: "campaign_from_notes",
        role,
        confidence: "medium",
        body: "x".repeat(60),
        reason: "test",
      });
    }
  }
  return {
    items,
    countsByRole: counts,
    recommendedPlatformsByRole: {},
    nextAction: "",
    roleHintsFromPlatformRouting: false,
  };
}

function fullRouting(
  defs: Partial<
    Record<
      RevenueOsPlatformRole,
      {
        preferredPlatform: string | null;
        confidence: "high" | "medium" | "low";
        evidenceBasis:
          | "measured_attention"
          | "measured_engagement"
          | "publish_only"
          | "insufficient_data";
      }
    >
  >
): RevenueOsPlatformRoleRoutingSummary {
  const roles: RevenueOsPlatformRole[] = [
    "attention",
    "engagement",
    "authority",
    "lead_capture",
    "distribution_support",
  ];
  return {
    recommendations: roles.map((role) => ({
      role,
      preferredPlatform: defs[role]?.preferredPlatform ?? null,
      confidence: defs[role]?.confidence ?? "low",
      reason: "t",
      evidenceBasis: defs[role]?.evidenceBasis ?? "insufficient_data",
    })),
    operationalRecommendation: "",
    confidenceNotes: [],
  };
}

describe("build-sequence-schedule-plan", () => {
  it("spreads slots across upcoming days (deterministic)", () => {
    const batch = makeBatch({ attention: 1, authority: 1, engagement: 1 });
    const routing = fullRouting({
      attention: { preferredPlatform: "instagram", confidence: "high", evidenceBasis: "measured_attention" },
      authority: { preferredPlatform: "linkedin", confidence: "medium", evidenceBasis: "measured_engagement" },
      engagement: { preferredPlatform: "linkedin", confidence: "medium", evidenceBasis: "measured_engagement" },
    });
    const seq = buildContentBatchCalendarSequence({
      batchRouting: batch,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: null,
    });
    const plan = buildSequenceSchedulePlan({
      batchCalendarSequence: seq,
      now: FIXED_NOW,
      userTimezoneHint: null,
    });
    expect(plan.slots.length).toBeGreaterThanOrEqual(2);
    const t0 = new Date(plan.slots[0]!.suggestedScheduledAt!).getTime();
    const t1 = new Date(plan.slots[1]!.suggestedScheduledAt!).getTime();
    expect(t1 - t0).toBeGreaterThan(20 * 3600000);
    expect(plan.timezoneStrategy).toBe("none");
    expect(plan.diagnostics?.timestampInterpretation).toBe("utc_midday_neutral");
  });

  it("uses zoned wall clock when user timezone is valid", () => {
    const batch = makeBatch({ attention: 1 });
    const routing = fullRouting({
      attention: { preferredPlatform: "instagram", confidence: "high", evidenceBasis: "measured_attention" },
    });
    const seq = buildContentBatchCalendarSequence({
      batchRouting: batch,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: null,
    });
    const plan = buildSequenceSchedulePlan({
      batchCalendarSequence: seq,
      now: FIXED_NOW,
      userTimezoneHint: "UTC",
    });
    expect(plan.timezoneStrategy).toBe("user_local");
    expect(plan.diagnostics?.timestampInterpretation).toBe("zoned_wall_clock");
    expect(plan.slots[0]?.suggestedScheduledAt).toMatch(/T\d{2}:\d{2}:\d{2}/);
  });

  it("keeps lead_capture late in the schedule when evidence justifies inclusion", () => {
    const batch = makeBatch({ attention: 1, authority: 1, engagement: 1, lead_capture: 1 });
    const routing = fullRouting({
      attention: { preferredPlatform: "instagram", confidence: "high", evidenceBasis: "measured_attention" },
      authority: { preferredPlatform: "linkedin", confidence: "medium", evidenceBasis: "measured_engagement" },
      engagement: { preferredPlatform: "linkedin", confidence: "medium", evidenceBasis: "measured_engagement" },
      lead_capture: {
        preferredPlatform: "instagram",
        confidence: "medium",
        evidenceBasis: "measured_engagement",
      },
    });
    const seq = buildContentBatchCalendarSequence({
      batchRouting: batch,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: null,
    });
    expect(seq.slots.some((s) => s.role === "lead_capture")).toBe(true);
    const plan = buildSequenceSchedulePlan({
      batchCalendarSequence: seq,
      now: FIXED_NOW,
      userTimezoneHint: null,
    });
    expect(plan.slots[plan.slots.length - 1]?.role).toBe("lead_capture");
  });
});
