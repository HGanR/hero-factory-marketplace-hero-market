/**
 * Reconcile local session launch progress with server-backed cycles (deterministic, no sync loops).
 */

import { getBentleyStorageScope } from "@/lib/revenue-os/bentley-storage-scope";
import type { LaunchCycleDbBundle, LaunchCycleEventRecord } from "@/lib/revenue-os/launch-progress-db";
import { LAUNCH_CYCLE_PROGRESS_STORAGE_KEY } from "@/lib/revenue-os/launch-progress-storage";
import type { RevenueOsLaunchCycleProgress } from "@/lib/revenue-os/launch-progress-types";

export type LaunchCycleReconcileWinner = "local" | "remote" | "none" | "tie";

export type LaunchCycleReconcileResult = {
  merged: RevenueOsLaunchCycleProgress | null;
  winner: LaunchCycleReconcileWinner;
  /** When local should be written to the server (new row or server behind). */
  shouldPushLocalToRemote: boolean;
};

/** Stable projection for equality and change detection (excludes serverCycleId). */
export function launchProgressMaterialFingerprint(progress: RevenueOsLaunchCycleProgress): string {
  return JSON.stringify({
    u: progress.updatedAt,
    c: progress.currentDay,
    s: progress.launchPlanSummary,
    d: progress.days.map((x) => [x.day, x.status, x.completedActions, x.notes ?? ""]),
    r: progress.readinessAtCreation,
    t: progress.trackingSnapshot ?? null,
  });
}

export function launchProgressesMateriallyEqual(
  a: RevenueOsLaunchCycleProgress,
  b: RevenueOsLaunchCycleProgress
): boolean {
  return launchProgressMaterialFingerprint(a) === launchProgressMaterialFingerprint(b);
}

/**
 * Timestamp-first merge; ties prefer remote so server ids stay canonical.
 */
export function reconcileLaunchCycleProgress(
  local: RevenueOsLaunchCycleProgress | null,
  remote: RevenueOsLaunchCycleProgress | null
): LaunchCycleReconcileResult {
  if (!local && !remote) {
    return { merged: null, winner: "none", shouldPushLocalToRemote: false };
  }
  if (local && !remote) {
    return {
      merged: { ...local, serverCycleId: local.serverCycleId ?? local.cycleId },
      winner: "local",
      shouldPushLocalToRemote: true,
    };
  }
  if (!local && remote) {
    return {
      merged: { ...remote, serverCycleId: remote.serverCycleId ?? remote.cycleId },
      winner: "remote",
      shouldPushLocalToRemote: false,
    };
  }

  const tL = Date.parse(local!.updatedAt);
  const tR = Date.parse(remote!.updatedAt);
  const lt = Number.isFinite(tL) ? tL : 0;
  const rt = Number.isFinite(tR) ? tR : 0;

  if (rt > lt) {
    return {
      merged: { ...remote!, serverCycleId: remote!.serverCycleId ?? remote!.cycleId },
      winner: "remote",
      shouldPushLocalToRemote: false,
    };
  }
  if (lt > rt) {
    return {
      merged: { ...local!, serverCycleId: local!.serverCycleId ?? remote?.serverCycleId ?? local!.cycleId },
      winner: "local",
      shouldPushLocalToRemote: true,
    };
  }

  if (launchProgressesMateriallyEqual(local!, remote!)) {
    return {
      merged: { ...remote!, serverCycleId: remote!.serverCycleId ?? remote!.cycleId },
      winner: "tie",
      shouldPushLocalToRemote: false,
    };
  }

  return {
    merged: { ...remote!, serverCycleId: remote!.serverCycleId ?? remote!.cycleId },
    winner: "tie",
    shouldPushLocalToRemote: false,
  };
}

export type RemoteLaunchFetchResult = {
  ok: boolean;
  status: number;
  latest: LaunchCycleDbBundle | null;
  recent: LaunchCycleDbBundle[];
  events: LaunchCycleEventRecord[];
};

export function isServerAssignedCycleId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function isServerBackedLaunchProgress(progress: RevenueOsLaunchCycleProgress): boolean {
  return isServerAssignedCycleId(progress.serverCycleId ?? progress.cycleId);
}

function buildScopeQuery(
  scopeKey: string,
  clientId: string,
  trustId: string,
  historyLimit?: number,
  eventLimit?: number
): string {
  const p = new URLSearchParams();
  p.set("scopeKey", scopeKey);
  p.set("clientId", clientId);
  p.set("trustId", trustId);
  if (historyLimit != null && historyLimit > 0) {
    p.set("historyLimit", String(Math.min(historyLimit, 25)));
  }
  if (eventLimit != null && eventLimit > 0) {
    p.set("eventLimit", String(Math.min(eventLimit, 100)));
  }
  return p.toString();
}

export async function fetchRemoteLaunchCycleState(
  scopeKey: string,
  clientId: string,
  trustId: string,
  historyLimit?: number,
  eventLimit?: number
): Promise<RemoteLaunchFetchResult> {
  try {
    const qs = buildScopeQuery(scopeKey, clientId, trustId, historyLimit, eventLimit);
    const res = await fetch(`/api/revenue-os/launch-cycle?${qs}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 401) {
      return { ok: false, status: 401, latest: null, recent: [], events: [] };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, latest: null, recent: [], events: [] };
    }
    const data = (await res.json()) as {
      latest: LaunchCycleDbBundle | null;
      recent?: LaunchCycleDbBundle[];
      events?: LaunchCycleEventRecord[];
    };
    return {
      ok: true,
      status: res.status,
      latest: data.latest ?? null,
      recent: Array.isArray(data.recent) ? data.recent : [],
      events: Array.isArray(data.events) ? data.events : [],
    };
  } catch {
    return { ok: false, status: 0, latest: null, recent: [], events: [] };
  }
}

export async function postLaunchCycleCreate(
  scopeKey: string,
  clientId: string,
  trustId: string,
  body: { progress: RevenueOsLaunchCycleProgress; plan?: unknown; signalsSnapshot?: unknown }
): Promise<{ ok: boolean; status: number; bundle: LaunchCycleDbBundle | null }> {
  try {
    const res = await fetch("/api/revenue-os/launch-cycle", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeKey,
        clientId,
        trustId,
        progress: body.progress,
        plan: body.plan ?? undefined,
        signalsSnapshot: body.signalsSnapshot ?? undefined,
      }),
    });
    if (res.status === 401) {
      return { ok: false, status: 401, bundle: null };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, bundle: null };
    }
    const data = (await res.json()) as { bundle: LaunchCycleDbBundle };
    return { ok: true, status: res.status, bundle: data.bundle ?? null };
  } catch {
    return { ok: false, status: 0, bundle: null };
  }
}

export async function patchLaunchCycleProgress(
  scopeKey: string,
  clientId: string,
  trustId: string,
  progress: RevenueOsLaunchCycleProgress,
  options?: { plan?: unknown; signalsSnapshot?: unknown }
): Promise<{ ok: boolean; status: number; bundle: LaunchCycleDbBundle | null }> {
  try {
    const res = await fetch("/api/revenue-os/launch-cycle", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeKey,
        clientId,
        trustId,
        progress,
        plan: options?.plan,
        signalsSnapshot: options?.signalsSnapshot,
      }),
    });
    if (res.status === 401) {
      return { ok: false, status: 401, bundle: null };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, bundle: null };
    }
    const data = (await res.json()) as { bundle: LaunchCycleDbBundle };
    return { ok: true, status: res.status, bundle: data.bundle ?? null };
  } catch {
    return { ok: false, status: 0, bundle: null };
  }
}

export function getLaunchSyncScopeFromWindow(): { scopeKey: string; clientId: string; trustId: string } {
  if (typeof window === "undefined") {
    return { scopeKey: LAUNCH_CYCLE_PROGRESS_STORAGE_KEY, clientId: "_", trustId: "" };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    scopeKey: LAUNCH_CYCLE_PROGRESS_STORAGE_KEY,
    clientId: params.get("clientId")?.trim() || getBentleyStorageScope()?.clientId || "_",
    trustId: params.get("trustId")?.trim() || "",
  };
}

export async function postLaunchCycleEvent(
  scopeKey: string,
  clientId: string,
  trustId: string,
  payload: { cycleId: string; eventType: string; dayNumber?: number | null; eventPayload?: Record<string, unknown> | null }
): Promise<boolean> {
  try {
    const res = await fetch("/api/revenue-os/launch-cycle/event", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scopeKey,
        clientId,
        trustId,
        ...payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
