/**
 * Server persistence for 7-Day Launch Mode — auth-scoped, no cross-user access.
 */

import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLaunchCycleTables } from "@/lib/db/revenue-os-launch-cycles-ensure";
import {
  revenueOsLaunchCycleDays,
  revenueOsLaunchCycleEvents,
  revenueOsLaunchCycles,
} from "@/lib/db/schema";
import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import type {
  RevenueOsLaunchCycleProgress,
  RevenueOsLaunchDayExecutionStatus,
  RevenueOsLaunchDayProgress,
} from "@/lib/revenue-os/launch-progress-types";
export type LaunchCycleDbScope = {
  userIdStr: string;
  clientId: string;
  trustId: string;
  scopeKey: string;
};

export type LaunchCycleDbBundle = {
  progress: RevenueOsLaunchCycleProgress;
  plan: RevenueOsLaunchModePlan | null;
};

type ReadinessJson = {
  isReady?: boolean;
  blockerCount?: number;
  blockers?: string[];
};

type CycleRow = typeof revenueOsLaunchCycles.$inferSelect;
type DayRow = typeof revenueOsLaunchCycleDays.$inferSelect;

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v.trim()) return v;
  return new Date().toISOString();
}

function coerceStatus(s: string | null | undefined): RevenueOsLaunchDayExecutionStatus {
  if (s === "in_progress" || s === "completed" || s === "blocked" || s === "not_started") return s;
  return "not_started";
}

function coerceDayNum(n: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (n >= 1 && n <= 7) return n as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  return 1;
}

function parseReadiness(raw: unknown): { isReady: boolean; blockerCount: number } {
  if (!raw || typeof raw !== "object") return { isReady: false, blockerCount: 0 };
  const o = raw as ReadinessJson;
  const isReady = typeof o.isReady === "boolean" ? o.isReady : false;
  if (typeof o.blockerCount === "number" && Number.isFinite(o.blockerCount)) {
    return { isReady, blockerCount: o.blockerCount };
  }
  if (Array.isArray(o.blockers)) {
    return { isReady, blockerCount: o.blockers.length };
  }
  return { isReady, blockerCount: 0 };
}

function parseTracking(raw: unknown): RevenueOsLaunchCycleProgress["trackingSnapshot"] {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const signalMaterialKey = typeof o.signalMaterialKey === "string" ? o.signalMaterialKey : "";
  const coreOfferNorm = typeof o.coreOfferNorm === "string" ? o.coreOfferNorm : "";
  const audienceNorm = typeof o.audienceNorm === "string" ? o.audienceNorm : "";
  if (!signalMaterialKey && !coreOfferNorm && !audienceNorm) return undefined;
  return { signalMaterialKey, coreOfferNorm, audienceNorm };
}

function parsePlanJson(raw: unknown): RevenueOsLaunchModePlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.summary !== "string" || !Array.isArray(p.days)) return null;
  return raw as RevenueOsLaunchModePlan;
}

function dayRowToProgress(d: DayRow): RevenueOsLaunchDayProgress {
  const actionsRaw = d.completedActionsJson;
  const completedActions = Array.isArray(actionsRaw)
    ? actionsRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim())
    : [];
  return {
    day: coerceDayNum(d.dayNumber),
    status: coerceStatus(d.status),
    completedActions,
    lastActionAt: d.lastActionAt ? toIso(d.lastActionAt) : undefined,
    notes: d.notesText ?? undefined,
  };
}

/** Exported for tests — maps DB rows to client progress shape. */
export function normalizeLaunchCycleFromDbRows(cycle: CycleRow, dayRows: DayRow[]): RevenueOsLaunchCycleProgress {
  const sorted = [...dayRows].sort((a, b) => a.dayNumber - b.dayNumber);
  const byDay = new Map<number, RevenueOsLaunchDayProgress>();
  for (const r of sorted) {
    byDay.set(r.dayNumber, dayRowToProgress(r));
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

  const readiness = parseReadiness(cycle.readinessJson);
  const currentDay = coerceDayNum(cycle.currentDay);

  return {
    cycleId: cycle.id,
    serverCycleId: cycle.id,
    createdAt: toIso(cycle.createdAt),
    updatedAt: toIso(cycle.updatedAt),
    launchPlanSummary: cycle.launchPlanSummary ?? "",
    readinessAtCreation: readiness,
    days,
    currentDay,
    trackingSnapshot: parseTracking(cycle.trackingSnapshotJson),
  };
}

async function loadDayRows(cycleId: string): Promise<DayRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(revenueOsLaunchCycleDays)
    .where(eq(revenueOsLaunchCycleDays.launchCycleId, cycleId));
}

function scopeMatch(scope: LaunchCycleDbScope) {
  return and(
    eq(revenueOsLaunchCycles.userId, scope.userIdStr),
    eq(revenueOsLaunchCycles.clientId, scope.clientId),
    eq(revenueOsLaunchCycles.trustId, scope.trustId),
    eq(revenueOsLaunchCycles.scopeKey, scope.scopeKey)
  );
}

export async function loadLatestLaunchCycleForUser(scope: LaunchCycleDbScope): Promise<LaunchCycleDbBundle | null> {
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(revenueOsLaunchCycles)
    .where(scopeMatch(scope))
    .orderBy(desc(revenueOsLaunchCycles.updatedAt))
    .limit(1);
  if (rows.length === 0) return null;
  const c = rows[0]!;
  const days = await loadDayRows(c.id);
  return {
    progress: normalizeLaunchCycleFromDbRows(c, days),
    plan: parsePlanJson(c.planJson),
  };
}

export async function loadLaunchCycleByIdForUser(
  userIdStr: string,
  cycleId: string
): Promise<LaunchCycleDbBundle | null> {
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(revenueOsLaunchCycles)
    .where(and(eq(revenueOsLaunchCycles.id, cycleId), eq(revenueOsLaunchCycles.userId, userIdStr)))
    .limit(1);
  if (rows.length === 0) return null;
  const c = rows[0]!;
  const days = await loadDayRows(c.id);
  return {
    progress: normalizeLaunchCycleFromDbRows(c, days),
    plan: parsePlanJson(c.planJson),
  };
}

export async function listLaunchCyclesForUser(scope: LaunchCycleDbScope, limit: number): Promise<LaunchCycleDbBundle[]> {
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  const lim = Math.min(Math.max(1, limit), 25);
  const rows = await db
    .select()
    .from(revenueOsLaunchCycles)
    .where(scopeMatch(scope))
    .orderBy(desc(revenueOsLaunchCycles.updatedAt))
    .limit(lim);

  const out: LaunchCycleDbBundle[] = [];
  for (const c of rows) {
    const days = await loadDayRows(c.id);
    out.push({
      progress: normalizeLaunchCycleFromDbRows(c, days),
      plan: parsePlanJson(c.planJson),
    });
  }
  return out;
}

export type CreateLaunchCycleInput = {
  progress: RevenueOsLaunchCycleProgress;
  plan?: RevenueOsLaunchModePlan | null;
  signalsSnapshot?: unknown;
};

export async function createLaunchCycleForUser(
  scope: LaunchCycleDbScope,
  input: CreateLaunchCycleInput
): Promise<LaunchCycleDbBundle> {
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  const id = randomUUID();
  const p = input.progress;
  const clientRef = p.cycleId !== id ? p.cycleId.slice(0, 80) : undefined;
  const readinessJson = {
    isReady: p.readinessAtCreation.isReady,
    blockerCount: p.readinessAtCreation.blockerCount,
  };

  await db.transaction(async (tx) => {
    await tx.insert(revenueOsLaunchCycles).values({
      id,
      userId: scope.userIdStr,
      clientId: scope.clientId,
      trustId: scope.trustId,
      scopeKey: scope.scopeKey,
      clientCycleRef: clientRef ?? null,
      launchPlanSummary: p.launchPlanSummary ?? "",
      readinessJson,
      planJson: input.plan ?? null,
      signalsSnapshotJson: input.signalsSnapshot ?? null,
      trackingSnapshotJson: p.trackingSnapshot ?? null,
      currentDay: p.currentDay,
      completedAt: null,
    });

    for (const d of p.days) {
      await tx.insert(revenueOsLaunchCycleDays).values({
        id: randomUUID(),
        launchCycleId: id,
        dayNumber: d.day,
        status: d.status,
        completedActionsJson: d.completedActions,
        notesText: d.notes ?? null,
        lastActionAt: d.lastActionAt ? new Date(d.lastActionAt) : null,
      });
    }
  });

  const cRow = (await db.select().from(revenueOsLaunchCycles).where(eq(revenueOsLaunchCycles.id, id)).limit(1))[0]!;
  const dayRows = await loadDayRows(id);
  return {
    progress: normalizeLaunchCycleFromDbRows(cRow, dayRows),
    plan: parsePlanJson(cRow.planJson),
  };
}

export async function saveLaunchCycleProgressForUser(
  userIdStr: string,
  progress: RevenueOsLaunchCycleProgress,
  options?: { plan?: RevenueOsLaunchModePlan | null; signalsSnapshot?: unknown }
): Promise<LaunchCycleDbBundle | null> {
  const cycleId = progress.serverCycleId ?? progress.cycleId;
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(revenueOsLaunchCycles)
    .where(and(eq(revenueOsLaunchCycles.id, cycleId), eq(revenueOsLaunchCycles.userId, userIdStr)))
    .limit(1);
  if (rows.length === 0) return null;

  const readinessJson = {
    isReady: progress.readinessAtCreation.isReady,
    blockerCount: progress.readinessAtCreation.blockerCount,
  };

  await db
    .update(revenueOsLaunchCycles)
    .set({
      launchPlanSummary: progress.launchPlanSummary ?? "",
      readinessJson,
      currentDay: progress.currentDay,
      trackingSnapshotJson: progress.trackingSnapshot ?? null,
      ...(options?.plan !== undefined ? { planJson: options.plan } : {}),
      ...(options?.signalsSnapshot !== undefined ? { signalsSnapshotJson: options.signalsSnapshot } : {}),
    })
    .where(eq(revenueOsLaunchCycles.id, cycleId));

  const existingDays = await loadDayRows(cycleId);
  const byNum = new Map(existingDays.map((r) => [r.dayNumber, r]));

  for (const d of progress.days) {
    const prev = byNum.get(d.day);
    if (prev) {
      await db
        .update(revenueOsLaunchCycleDays)
        .set({
          status: d.status,
          completedActionsJson: d.completedActions,
          notesText: d.notes ?? null,
          lastActionAt: d.lastActionAt ? new Date(d.lastActionAt) : null,
        })
        .where(eq(revenueOsLaunchCycleDays.id, prev.id));
    } else {
      await db.insert(revenueOsLaunchCycleDays).values({
        id: randomUUID(),
        launchCycleId: cycleId,
        dayNumber: d.day,
        status: d.status,
        completedActionsJson: d.completedActions,
        notesText: d.notes ?? null,
        lastActionAt: d.lastActionAt ? new Date(d.lastActionAt) : null,
      });
    }
  }

  const cRow = (await db.select().from(revenueOsLaunchCycles).where(eq(revenueOsLaunchCycles.id, cycleId)).limit(1))[0]!;
  const dayRows = await loadDayRows(cycleId);
  return {
    progress: normalizeLaunchCycleFromDbRows(cRow, dayRows),
    plan: parsePlanJson(cRow.planJson),
  };
}

async function touchLaunchCycleRow(userIdStr: string, cycleId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(revenueOsLaunchCycles)
    .set({ updatedAt: new Date() })
    .where(and(eq(revenueOsLaunchCycles.id, cycleId), eq(revenueOsLaunchCycles.userId, userIdStr)));
}

export async function saveLaunchDayProgressForUser(
  userIdStr: string,
  cycleId: string,
  day: 1 | 2 | 3 | 4 | 5 | 6 | 7,
  patch: Partial<Pick<RevenueOsLaunchDayProgress, "status" | "completedActions" | "notes" | "lastActionAt">>
): Promise<boolean> {
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  const own = await db
    .select({ id: revenueOsLaunchCycles.id })
    .from(revenueOsLaunchCycles)
    .where(and(eq(revenueOsLaunchCycles.id, cycleId), eq(revenueOsLaunchCycles.userId, userIdStr)))
    .limit(1);
  if (own.length === 0) return false;

  const existing = await db
    .select()
    .from(revenueOsLaunchCycleDays)
    .where(
      and(eq(revenueOsLaunchCycleDays.launchCycleId, cycleId), eq(revenueOsLaunchCycleDays.dayNumber, day))
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(revenueOsLaunchCycleDays).values({
      id: randomUUID(),
      launchCycleId: cycleId,
      dayNumber: day,
      status: patch.status ?? "not_started",
      completedActionsJson: patch.completedActions ?? [],
      notesText: patch.notes ?? null,
      lastActionAt: patch.lastActionAt ? new Date(patch.lastActionAt) : null,
    });
    await touchLaunchCycleRow(userIdStr, cycleId);
    return true;
  }

  const row = existing[0]!;
  await db
    .update(revenueOsLaunchCycleDays)
    .set({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.completedActions !== undefined ? { completedActionsJson: patch.completedActions } : {}),
      ...(patch.notes !== undefined ? { notesText: patch.notes } : {}),
      ...(patch.lastActionAt !== undefined
        ? { lastActionAt: patch.lastActionAt ? new Date(patch.lastActionAt) : null }
        : {}),
    })
    .where(eq(revenueOsLaunchCycleDays.id, row.id));
  await touchLaunchCycleRow(userIdStr, cycleId);
  return true;
}

export async function appendLaunchCycleEventForUser(
  userIdStr: string,
  cycleId: string,
  event: {
    eventType: string;
    dayNumber?: number | null;
    payload?: Record<string, unknown> | null;
  }
): Promise<boolean> {
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  const own = await db
    .select({ id: revenueOsLaunchCycles.id })
    .from(revenueOsLaunchCycles)
    .where(and(eq(revenueOsLaunchCycles.id, cycleId), eq(revenueOsLaunchCycles.userId, userIdStr)))
    .limit(1);
  if (own.length === 0) return false;

  await db.insert(revenueOsLaunchCycleEvents).values({
    id: randomUUID(),
    launchCycleId: cycleId,
    dayNumber: event.dayNumber ?? null,
    eventType: event.eventType.slice(0, 64),
    eventPayloadJson: event.payload ?? null,
  });
  await touchLaunchCycleRow(userIdStr, cycleId);
  return true;
}

export async function completeLaunchCycleForUser(userIdStr: string, cycleId: string): Promise<boolean> {
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  await db
    .update(revenueOsLaunchCycles)
    .set({ completedAt: new Date() })
    .where(and(eq(revenueOsLaunchCycles.id, cycleId), eq(revenueOsLaunchCycles.userId, userIdStr)));
  const check = await db
    .select({ completedAt: revenueOsLaunchCycles.completedAt })
    .from(revenueOsLaunchCycles)
    .where(and(eq(revenueOsLaunchCycles.id, cycleId), eq(revenueOsLaunchCycles.userId, userIdStr)))
    .limit(1);
  return check[0]?.completedAt != null;
}

export type LaunchCycleEventRecord = {
  eventType: string;
  dayNumber: number | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export async function listLaunchCycleEventsForUser(
  userIdStr: string,
  cycleId: string,
  limit: number
): Promise<LaunchCycleEventRecord[]> {
  await ensureRevenueOsLaunchCycleTables();
  const db = await getDb();
  const own = await db
    .select({ id: revenueOsLaunchCycles.id })
    .from(revenueOsLaunchCycles)
    .where(and(eq(revenueOsLaunchCycles.id, cycleId), eq(revenueOsLaunchCycles.userId, userIdStr)))
    .limit(1);
  if (own.length === 0) return [];

  const lim = Math.min(Math.max(1, limit), 100);
  const rows = await db
    .select()
    .from(revenueOsLaunchCycleEvents)
    .where(eq(revenueOsLaunchCycleEvents.launchCycleId, cycleId))
    .orderBy(desc(revenueOsLaunchCycleEvents.createdAt))
    .limit(lim);

  return rows.map((r) => ({
    eventType: r.eventType,
    dayNumber: r.dayNumber ?? null,
    payload:
      r.eventPayloadJson && typeof r.eventPayloadJson === "object"
        ? (r.eventPayloadJson as Record<string, unknown>)
        : null,
    createdAt: toIso(r.createdAt),
  }));
}
