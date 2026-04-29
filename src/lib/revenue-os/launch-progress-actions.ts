/**
 * Pure helpers — immutable updates to launch cycle progress.
 */

import type {
  RevenueOsLaunchCycleProgress,
  RevenueOsLaunchDayExecutionStatus,
} from "@/lib/revenue-os/launch-progress-types";

const nowIso = (): string => new Date().toISOString();

function patchDay(
  progress: RevenueOsLaunchCycleProgress,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  patch: (d: (typeof progress.days)[0]) => (typeof progress.days)[0]
): RevenueOsLaunchCycleProgress {
  return {
    ...progress,
    updatedAt: nowIso(),
    days: progress.days.map((d) => (d.day === day ? patch(d) : d)),
  };
}

export function markLaunchDayActionCompleted(
  progress: RevenueOsLaunchCycleProgress,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  actionLabel: string
): RevenueOsLaunchCycleProgress {
  const label = actionLabel.trim();
  if (!label) return progress;
  return patchDay(progress, day, (d) => {
    if (d.completedActions.includes(label)) return { ...d, lastActionAt: nowIso() };
    const nextStatus: RevenueOsLaunchDayExecutionStatus =
      d.status === "not_started" ? "in_progress" : d.status === "blocked" ? "blocked" : d.status;
    return {
      ...d,
      status: nextStatus,
      completedActions: [...d.completedActions, label],
      lastActionAt: nowIso(),
    };
  });
}

export function setLaunchDayNotes(
  progress: RevenueOsLaunchCycleProgress,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  notes: string
): RevenueOsLaunchCycleProgress {
  return patchDay(progress, day, (d) => ({ ...d, notes }));
}

export function advanceLaunchCurrentDayIfReady(progress: RevenueOsLaunchCycleProgress): RevenueOsLaunchCycleProgress {
  const ordered: (1 | 2 | 3 | 4 | 5 | 6 | 7)[] = [1, 2, 3, 4, 5, 6, 7];
  const firstIncomplete = ordered.find((dn) => {
    const row = progress.days.find((x) => x.day === dn);
    return row && row.status !== "completed";
  });
  const nextCurrent = (firstIncomplete ?? 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  if (nextCurrent === progress.currentDay) return progress;
  return { ...progress, currentDay: nextCurrent, updatedAt: nowIso() };
}

export function setLaunchDayStatus(
  progress: RevenueOsLaunchCycleProgress,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  status: RevenueOsLaunchDayExecutionStatus,
  notes?: string
): RevenueOsLaunchCycleProgress {
  let next = patchDay(progress, day, (d) => ({
    ...d,
    status,
    ...(notes !== undefined ? { notes } : {}),
    lastActionAt: nowIso(),
  }));

  if (status === "completed") {
    next = advanceLaunchCurrentDayIfReady(next);
  }

  return next;
}

/** Reset one day to not_started and clear its log (notes optional clear). */
export function resetLaunchDay(
  progress: RevenueOsLaunchCycleProgress,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  options?: { clearNotes?: boolean }
): RevenueOsLaunchCycleProgress {
  let next = patchDay(progress, day, (d) => ({
    ...d,
    status: "not_started" as const,
    completedActions: [],
    lastActionAt: undefined,
    ...(options?.clearNotes ? { notes: undefined } : {}),
  }));
  next = { ...next, currentDay: day, updatedAt: nowIso() };
  return next;
}

export function allLaunchDaysCompleted(progress: RevenueOsLaunchCycleProgress): boolean {
  return progress.days.every((d) => d.status === "completed");
}
