/**
 * Pure analytics over launch cycle progress (Bentley + debug UI).
 */

import type { RevenueOsLaunchCycleProgress } from "@/lib/revenue-os/launch-progress-types";

export type LaunchCycleMomentum = "strong" | "mixed" | "stalled";

export type LaunchCycleAnalyticsSummary = {
  completedDayCount: number;
  blockedDayCount: number;
  completionRate: number;
  currentMomentum: LaunchCycleMomentum;
  lastMeaningfulActionAt: string | null;
  stalePlan: boolean;
  mostActiveDay: number | null;
  leastCompleteDay: number | null;
};

export type LaunchHistoryAnalyticsSummary = {
  cyclesReviewed: number;
  avgCompletionRate: number;
  lastCycleCompletedDays: number | null;
  trendHint: "improving" | "flat" | "unclear";
  note: string;
};

function normSummary(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function maxIso(a: string | undefined, b: string | null): string | null {
  if (!a?.trim()) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export function summarizeLaunchCycleAnalytics(
  cycle: RevenueOsLaunchCycleProgress,
  opts?: { livePlanSummary?: string }
): LaunchCycleAnalyticsSummary {
  const completedDayCount = cycle.days.filter((d) => d.status === "completed").length;
  const blockedDayCount = cycle.days.filter((d) => d.status === "blocked").length;
  const completionRate = completedDayCount / 7;

  let lastMeaningfulActionAt: string | null = null;
  for (const d of cycle.days) {
    lastMeaningfulActionAt = maxIso(d.lastActionAt, lastMeaningfulActionAt);
    if (d.completedActions.length) {
      lastMeaningfulActionAt = lastMeaningfulActionAt ?? cycle.updatedAt;
    }
  }
  lastMeaningfulActionAt = maxIso(cycle.updatedAt, lastMeaningfulActionAt);

  let mostActiveDay: number | null = null;
  let bestCount = -1;
  for (const d of cycle.days) {
    if (d.completedActions.length > bestCount) {
      bestCount = d.completedActions.length;
      mostActiveDay = d.day;
    }
  }
  if (bestCount <= 0) mostActiveDay = null;

  const leastCompleteDayRow = cycle.days.find((d) => d.status !== "completed");
  const leastCompleteDay = leastCompleteDayRow ? leastCompleteDayRow.day : null;

  const recent = cycle.days.filter((d) => d.day >= cycle.currentDay - 1 && d.day <= cycle.currentDay + 1);
  const recentActive = recent.some((d) => d.status === "in_progress" || d.completedActions.length > 0);
  const stalledByBlock = blockedDayCount >= 2;
  const stalledByTime =
    lastMeaningfulActionAt != null &&
    Date.now() - Date.parse(lastMeaningfulActionAt) > 7 * 24 * 60 * 60 * 1000;

  let currentMomentum: LaunchCycleMomentum = "mixed";
  if (stalledByBlock || stalledByTime) {
    currentMomentum = "stalled";
  } else if (completedDayCount >= 4 || (recentActive && blockedDayCount === 0)) {
    currentMomentum = "strong";
  }

  const live = opts?.livePlanSummary != null ? normSummary(opts.livePlanSummary) : "";
  const saved = normSummary(cycle.launchPlanSummary);
  const stalePlan = Boolean(live && saved && live !== saved);

  return {
    completedDayCount,
    blockedDayCount,
    completionRate,
    currentMomentum,
    lastMeaningfulActionAt,
    stalePlan,
    mostActiveDay,
    leastCompleteDay,
  };
}

export function summarizeLaunchHistoryAnalytics(cycles: RevenueOsLaunchCycleProgress[]): LaunchHistoryAnalyticsSummary {
  if (cycles.length === 0) {
    return {
      cyclesReviewed: 0,
      avgCompletionRate: 0,
      lastCycleCompletedDays: null,
      trendHint: "unclear",
      note: "No prior launch cycles on record.",
    };
  }

  const rates = cycles.map((c) => c.days.filter((d) => d.status === "completed").length / 7);
  const avgCompletionRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  const last = cycles[0]!;
  const lastCompleted = last.days.filter((d) => d.status === "completed").length;

  let trendHint: LaunchHistoryAnalyticsSummary["trendHint"] = "unclear";
  if (cycles.length >= 2) {
    const prev = cycles[1]!;
    const prevCompleted = prev.days.filter((d) => d.status === "completed").length;
    if (lastCompleted > prevCompleted) trendHint = "improving";
    else if (lastCompleted === prevCompleted) trendHint = "flat";
  }

  return {
    cyclesReviewed: cycles.length,
    avgCompletionRate,
    lastCycleCompletedDays: lastCompleted,
    trendHint,
    note:
      trendHint === "improving"
        ? "Your latest cycle shows more completed days than the prior one."
        : trendHint === "flat"
          ? "Completion depth is similar to your last cycle — tighten daily execution to break through."
          : "Not enough history yet to infer a trend.",
  };
}
