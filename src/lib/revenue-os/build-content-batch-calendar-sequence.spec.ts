import {
  ALL_CONTENT_BATCH_ROLES,
  emptyCountsByRole,
  type RevenueOsContentBatchRoutingSummary,
  type RevenueOsContentBatchRole,
  type RevenueOsRoutedContentItem,
} from "@/lib/revenue-os/content-batch-routing-types";
import {
  alignSequenceSlotsToLaunchDays,
  allowLeadCaptureInSequence,
  buildContentBatchCalendarSequence,
} from "@/lib/revenue-os/build-content-batch-calendar-sequence";
import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import type {
  RevenueOsPlatformRole,
  RevenueOsPlatformRoleRoutingSummary,
} from "@/lib/revenue-os/platform-role-routing";

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

function launch7(): RevenueOsLaunchModePlan {
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    day: d as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    title: `D${d}`,
    objective: `Objective for day ${d} with enough text to be substantive.`,
    tasks: ["t"],
    deliverables: ["d"],
  }));
  return { summary: "s", days, readiness: { isReady: true, blockers: [], strengths: [] } };
}

describe("build-content-batch-calendar-sequence", () => {
  it("defaults to attention → authority → engagement for the first three beats", () => {
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
    expect(seq.slots.length).toBeGreaterThanOrEqual(3);
    expect(seq.slots.slice(0, 3).map((s) => s.role)).toEqual(["attention", "authority", "engagement"]);
    expect(seq.diagnostics?.authorityFirstApplied).toBe(false);
  });

  it("uses authority-first when attention is weak and authority is measurably stronger", () => {
    const batch = makeBatch({ attention: 1, authority: 1, engagement: 1 });
    const routing = fullRouting({
      attention: { preferredPlatform: null, confidence: "low", evidenceBasis: "insufficient_data" },
      authority: { preferredPlatform: "linkedin", confidence: "medium", evidenceBasis: "measured_engagement" },
      engagement: { preferredPlatform: "linkedin", confidence: "medium", evidenceBasis: "measured_engagement" },
    });
    const seq = buildContentBatchCalendarSequence({
      batchRouting: batch,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: { trafficReadinessScore: 60 },
    });
    expect(seq.slots[0]?.role).toBe("authority");
    expect(seq.diagnostics?.authorityFirstApplied).toBe(true);
  });

  it("suppresses lead_capture in the sequence without conversion evidence", () => {
    const batch = makeBatch({ attention: 1, lead_capture: 1 });
    const routing = fullRouting({
      attention: { preferredPlatform: "instagram", confidence: "high", evidenceBasis: "measured_attention" },
      lead_capture: { preferredPlatform: null, confidence: "low", evidenceBasis: "insufficient_data" },
    });
    expect(allowLeadCaptureInSequence(routing)).toBe(false);
    const seq = buildContentBatchCalendarSequence({
      batchRouting: batch,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: null,
    });
    expect(seq.slots.every((s) => s.role !== "lead_capture")).toBe(true);
    expect(seq.diagnostics?.leadCaptureSuppressed).toBe(true);
    expect(seq.diagnostics?.rolesOmittedLowSignal).toContain("lead_capture");
  });

  it("propagates platform hints into sequence slots", () => {
    const batch = makeBatch({ attention: 1 });
    const routing = fullRouting({
      attention: { preferredPlatform: "tiktok", confidence: "high", evidenceBasis: "measured_attention" },
    });
    const seq = buildContentBatchCalendarSequence({
      batchRouting: batch,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: null,
    });
    expect(seq.slots[0]?.preferredPlatforms.map((p) => p.toLowerCase())).toContain("tiktok");
  });

  it("aligns day indices to a 7-day launch plan when present", () => {
    const batch = makeBatch({ attention: 1, authority: 1, engagement: 1 });
    const routing = fullRouting({
      attention: { preferredPlatform: "instagram", confidence: "high", evidenceBasis: "measured_attention" },
      authority: { preferredPlatform: "linkedin", confidence: "medium", evidenceBasis: "measured_engagement" },
      engagement: { preferredPlatform: "linkedin", confidence: "medium", evidenceBasis: "measured_engagement" },
    });
    const withoutLaunch = buildContentBatchCalendarSequence({
      batchRouting: batch,
      platformRoleRouting: routing,
      launchPlan: null,
      systemSignals: null,
    });
    const withLaunch = buildContentBatchCalendarSequence({
      batchRouting: batch,
      platformRoleRouting: routing,
      launchPlan: launch7(),
      systemSignals: null,
    });
    expect(withoutLaunch.diagnostics?.launchAlignmentApplied).toBe(false);
    expect(withLaunch.diagnostics?.launchAlignmentApplied).toBe(true);
    const n = withLaunch.slots.length;
    const linear = alignSequenceSlotsToLaunchDays(n, null);
    const mapped = alignSequenceSlotsToLaunchDays(n, launch7());
    expect(linear).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    expect(mapped[0]).toBe(1);
    if (n >= 2) expect(mapped[1]).toBeLessThanOrEqual(2);
  });
});
