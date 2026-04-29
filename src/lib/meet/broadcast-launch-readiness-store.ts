/**
 * Launch readiness for broadcast events — derives from server state and prepare-launch.
 */

import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions, streamDestinations } from "@/lib/db/schema";
import type { BroadcastEvent } from "./broadcast-events";
import { getBroadcastCalendarLinkByBroadcastEventId } from "./broadcast-calendar-link-store";
import {
  buildBroadcastLaunchReadinessReport,
  type BroadcastLaunchReadinessReport,
} from "./broadcast-launch-readiness";
import { prepareBroadcastEventLaunch, getBroadcastEventById, listUpcomingBroadcastEvents } from "./broadcast-event-store";
import { resolveBroadcastStartScene } from "./broadcast-start-scene";
import { BROADCAST_LIVE_STATUSES } from "./broadcast-constants";

export async function countActiveStreamDestinationsForUser(userId: number): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: streamDestinations.id })
    .from(streamDestinations)
    .where(and(eq(streamDestinations.userId, userId), eq(streamDestinations.isActive, true)));
  return rows.length;
}

export async function detectBroadcastLaunchConflicts(userId: number, event: BroadcastEvent): Promise<number | null> {
  const room = event.roomId?.trim();
  if (!room) return null;

  const db = await getDb();
  const rows = await db
    .select({ id: meetBroadcastSessions.id })
    .from(meetBroadcastSessions)
    .where(
      and(
        eq(meetBroadcastSessions.userId, userId),
        eq(meetBroadcastSessions.roomId, room),
        inArray(meetBroadcastSessions.status, [...BROADCAST_LIVE_STATUSES]),
        isNotNull(meetBroadcastSessions.broadcastEventId),
        ne(meetBroadcastSessions.broadcastEventId, event.id)
      )
    )
    .limit(1);

  const id = rows[0]?.id;
  return id != null ? Number(id) : null;
}

export async function getBroadcastLaunchReadinessReportForEvent(
  userId: number,
  broadcastEventId: number
): Promise<BroadcastLaunchReadinessReport | null> {
  const event = await getBroadcastEventById(broadcastEventId, userId);
  if (!event) return null;

  const computedAtIso = new Date().toISOString();

  let sceneUsedPreset = false;
  let sceneResolveWarnings: string[] = [];
  try {
    const sceneRes = await resolveBroadcastStartScene({
      userId,
      scenePresetId: event.scenePresetId ?? undefined,
      legacyLayoutMode: "grid",
    });
    sceneUsedPreset = sceneRes.snapshot.appliedPresetId != null;
    sceneResolveWarnings = [...sceneRes.resolveWarnings];
  } catch {
    sceneResolveWarnings = ["scene_resolve_failed"];
  }

  const prepareResult = await prepareBroadcastEventLaunch(userId, broadcastEventId);
  const prepareOk = prepareResult.ok;
  const prepareErrors = prepareOk ? [] : prepareResult.errors;
  const appliedShowPackageId = prepareOk ? prepareResult.config.appliedShowPackageId : null;

  const [activeDestinationCount, calLink, conflictingLiveSessionId] = await Promise.all([
    countActiveStreamDestinationsForUser(userId),
    getBroadcastCalendarLinkByBroadcastEventId(broadcastEventId, userId),
    detectBroadcastLaunchConflicts(userId, event),
  ]);

  return buildBroadcastLaunchReadinessReport(
    {
      event,
      prepareResult: prepareOk ? { ok: true } : { ok: false, errors: prepareErrors },
      appliedShowPackageId,
      activeDestinationCount,
      hasCalendarLink: calLink != null,
      conflictingLiveSessionId,
      sceneUsedPreset,
      sceneResolveWarnings,
    },
    computedAtIso
  );
}

export type UpcomingReadinessSummary = {
  event: BroadcastEvent;
  report: BroadcastLaunchReadinessReport;
};

export async function getUpcomingBroadcastLaunchReadinessReports(
  userId: number,
  options?: { horizonHours?: number; maxEvents?: number }
): Promise<UpcomingReadinessSummary[]> {
  const horizonHours = Math.min(168, Math.max(1, options?.horizonHours ?? 168));
  const maxEvents = Math.min(30, Math.max(1, options?.maxEvents ?? 20));
  const now = Date.now();
  const horizonMs = horizonHours * 3600 * 1000;

  const upcoming = await listUpcomingBroadcastEvents(userId, 50);
  const filtered = upcoming.filter((e) => {
    const t = new Date(e.scheduledStartIso).getTime();
    return Number.isFinite(t) && t <= now + horizonMs;
  });

  const out: UpcomingReadinessSummary[] = [];
  for (const event of filtered.slice(0, maxEvents)) {
    const report = await getBroadcastLaunchReadinessReportForEvent(userId, event.id);
    if (report) out.push({ event, report });
  }
  return out;
}
