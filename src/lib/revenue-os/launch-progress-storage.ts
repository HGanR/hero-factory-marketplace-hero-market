/**
 * Session-scoped persistence for launch cycle progress (same pattern as Bentley workflow).
 */

import type {
  RevenueOsLaunchModePlan,
  RevenueOsLaunchSharedProfile,
} from "@/lib/revenue-os/launch-mode-types";
import type { RevenueOsLaunchCycleProgress, RevenueOsLaunchDayProgress } from "@/lib/revenue-os/launch-progress-types";
import { systemSignalsMaterialKey } from "@/lib/revenue-os/bentley-system-signal-diagnostics";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import {
  bentleyScopedSessionKey,
  readBentleySessionWithLegacyFallback,
  removeBentleySessionScopedAndLegacy,
  writeBentleySession,
} from "@/lib/revenue-os/bentley-storage-scope";

export const LAUNCH_CYCLE_PROGRESS_STORAGE_KEY = "revenue-os:launch-cycle-progress-v1";

export const LAUNCH_PROGRESS_UPDATED_EVENT = "airos-launch-progress-updated";

function normText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function defaultDays(): RevenueOsLaunchDayProgress[] {
  return ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => ({
    day,
    status: "not_started" as const,
    completedActions: [],
  }));
}

function isDay(n: unknown): n is 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return n === 1 || n === 2 || n === 3 || n === 4 || n === 5 || n === 6 || n === 7;
}

/** Shared validation for API bodies and session JSON (returns null if invalid). */
export function coerceLaunchCycleProgress(raw: unknown): RevenueOsLaunchCycleProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const cycleId = typeof o.cycleId === "string" && o.cycleId.trim() ? o.cycleId.trim() : null;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : null;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : null;
  const launchPlanSummary = typeof o.launchPlanSummary === "string" ? o.launchPlanSummary : "";
  const readiness = o.readinessAtCreation;
  if (!cycleId || !createdAt || !updatedAt || !readiness || typeof readiness !== "object") return null;
  const r = readiness as Record<string, unknown>;
  const isReady = typeof r.isReady === "boolean" ? r.isReady : false;
  const blockerCount = typeof r.blockerCount === "number" && Number.isFinite(r.blockerCount) ? r.blockerCount : 0;
  let currentDay: 1 | 2 | 3 | 4 | 5 | 6 | 7 = 1;
  if (isDay(o.currentDay)) currentDay = o.currentDay;

  const byDay = new Map<number, RevenueOsLaunchDayProgress>();
  if (Array.isArray(o.days)) {
    for (const row of o.days) {
      if (!row || typeof row !== "object") continue;
      const d = row as Record<string, unknown>;
      if (!isDay(d.day)) continue;
      const statusRaw = d.status;
      const status =
        statusRaw === "in_progress" ||
        statusRaw === "completed" ||
        statusRaw === "blocked" ||
        statusRaw === "not_started"
          ? statusRaw
          : "not_started";
      const completedActions = Array.isArray(d.completedActions)
        ? d.completedActions.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
        : [];
      const lastActionAt = typeof d.lastActionAt === "string" ? d.lastActionAt : undefined;
      const notes = typeof d.notes === "string" ? d.notes : undefined;
      byDay.set(d.day, {
        day: d.day,
        status,
        completedActions,
        lastActionAt,
        notes,
      });
    }
  }

  const days: RevenueOsLaunchDayProgress[] = ([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
    return (
      byDay.get(day) ?? {
        day,
        status: "not_started",
        completedActions: [],
      }
    );
  });

  let trackingSnapshot: RevenueOsLaunchCycleProgress["trackingSnapshot"];
  const ts = o.trackingSnapshot;
  if (ts && typeof ts === "object") {
    const t = ts as Record<string, unknown>;
    const signalMaterialKey = typeof t.signalMaterialKey === "string" ? t.signalMaterialKey : "";
    const coreOfferNorm = typeof t.coreOfferNorm === "string" ? t.coreOfferNorm : "";
    const audienceNorm = typeof t.audienceNorm === "string" ? t.audienceNorm : "";
    if (signalMaterialKey || coreOfferNorm || audienceNorm) {
      trackingSnapshot = { signalMaterialKey, coreOfferNorm, audienceNorm };
    }
  }

  const serverCycleId =
    typeof o.serverCycleId === "string" && o.serverCycleId.trim()
      ? o.serverCycleId.trim()
      : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cycleId)
        ? cycleId
        : undefined;

  return {
    cycleId,
    createdAt,
    updatedAt,
    launchPlanSummary,
    readinessAtCreation: { isReady, blockerCount },
    days,
    currentDay,
    ...(trackingSnapshot ? { trackingSnapshot } : {}),
    ...(serverCycleId ? { serverCycleId } : {}),
  };
}

export function notifyLaunchProgressUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LAUNCH_PROGRESS_UPDATED_EVENT));
}

/**
 * @param scopeKey — storage base key (default LAUNCH_CYCLE_PROGRESS_KEY); scoped via bentleyScopedSessionKey.
 */
export function loadLaunchCycleProgress(scopeKey: string = LAUNCH_CYCLE_PROGRESS_STORAGE_KEY): RevenueOsLaunchCycleProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = readBentleySessionWithLegacyFallback(scopeKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return coerceLaunchCycleProgress(parsed);
  } catch {
    return null;
  }
}

export function saveLaunchCycleProgress(
  scopeKey: string,
  progress: RevenueOsLaunchCycleProgress,
  options?: { silent?: boolean }
): void {
  if (typeof window === "undefined") return;
  try {
    writeBentleySession(scopeKey, JSON.stringify(progress));
    if (!options?.silent) notifyLaunchProgressUpdated();
  } catch {
    /* quota */
  }
}

export function clearLaunchCycleProgress(scopeKey: string = LAUNCH_CYCLE_PROGRESS_STORAGE_KEY): void {
  if (typeof window === "undefined") return;
  removeBentleySessionScopedAndLegacy(scopeKey);
  notifyLaunchProgressUpdated();
}

export function createLaunchCycleProgress(
  plan: RevenueOsLaunchModePlan,
  context?: {
    systemSignals: RevenueOsSystemSignals;
    sharedProfile: RevenueOsLaunchSharedProfile;
  }
): RevenueOsLaunchCycleProgress {
  const now = new Date().toISOString();
  const trackingSnapshot: RevenueOsLaunchCycleProgress["trackingSnapshot"] | undefined = context
    ? {
        signalMaterialKey: systemSignalsMaterialKey(context.systemSignals),
        coreOfferNorm: normText(context.sharedProfile.coreOffer).slice(0, 240),
        audienceNorm: normText(context.sharedProfile.targetAudience).slice(0, 240),
      }
    : undefined;

  return {
    cycleId: `lc-${Date.now()}-${Math.floor(Math.random() * 1e6)
      .toString(36)
      .padStart(4, "0")}`,
    createdAt: now,
    updatedAt: now,
    launchPlanSummary: plan.summary,
    readinessAtCreation: {
      isReady: plan.readiness.isReady,
      blockerCount: plan.readiness.blockers.length,
    },
    days: defaultDays(),
    currentDay: 1,
    ...(trackingSnapshot ? { trackingSnapshot } : {}),
  };
}

export function peekLaunchProgressStorageKey(scopeKey: string = LAUNCH_CYCLE_PROGRESS_STORAGE_KEY): string {
  return bentleyScopedSessionKey(scopeKey);
}
