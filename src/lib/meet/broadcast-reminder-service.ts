/**
 * Computes upcoming reminder items from broadcast schedule + launch readiness (no persistence).
 */

import type { BroadcastEvent } from "./broadcast-events";
import { listUpcomingBroadcastEvents } from "./broadcast-event-store";
import type { BroadcastLaunchReadinessReport } from "./broadcast-launch-readiness";
import { getBroadcastLaunchReadinessReportForEvent } from "./broadcast-launch-readiness-store";
import {
  buildComputedReminderId,
  type BroadcastReminderItem,
  type BroadcastReminderType,
} from "./broadcast-reminders";

const MS_MIN = 60_000;
const MS_HOUR = 3600_000;

function iso(d: Date): string {
  return d.toISOString();
}

function minutesUntil(startMs: number, nowMs: number): number {
  return (startMs - nowMs) / MS_MIN;
}

function pushTimeBucket(
  out: BroadcastReminderItem[],
  userId: number,
  event: BroadcastEvent,
  reminderType: BroadcastReminderType,
  scheduledFor: Date,
  summary: string,
  detail?: string,
  nowIso: string
): void {
  out.push({
    id: buildComputedReminderId(event.id, reminderType),
    userId,
    broadcastEventId: event.id,
    reminderType,
    scheduledForIso: iso(scheduledFor),
    status: "pending",
    summary,
    detail,
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}

/**
 * Build time-based reminders for events starting within `horizonHours` (default 24).
 * Buckets: 60m, 30m, 10m before start (non-overlapping windows).
 */
export async function buildReminderItemsForUpcomingEvents(
  userId: number,
  nowIso: string,
  options?: { horizonHours?: number }
): Promise<BroadcastReminderItem[]> {
  const horizonHours = Math.min(168, Math.max(1, options?.horizonHours ?? 24));
  const now = new Date(nowIso);
  const nowMs = now.getTime();
  const horizonMs = horizonHours * MS_HOUR;

  const events = await listUpcomingBroadcastEvents(userId, 60);
  const out: BroadcastReminderItem[] = [];

  for (const event of events) {
    const startMs = new Date(event.scheduledStartIso).getTime();
    if (!Number.isFinite(startMs) || startMs <= nowMs) continue;
    if (startMs - nowMs > horizonMs) continue;

    const m = minutesUntil(startMs, nowMs);

    if (m <= 10 && m > 0) {
      pushTimeBucket(
        out,
        userId,
        event,
        "event_starting_10m",
        new Date(startMs - 10 * MS_MIN),
        `Starting soon: ${event.title}`,
        "Within 10 minutes of scheduled start.",
        nowIso
      );
    } else if (m <= 30 && m > 10) {
      pushTimeBucket(
        out,
        userId,
        event,
        "event_starting_30m",
        new Date(startMs - 30 * MS_MIN),
        `Upcoming: ${event.title}`,
        "Within 30 minutes of scheduled start.",
        nowIso
      );
    } else if (m <= 60 && m > 30) {
      pushTimeBucket(
        out,
        userId,
        event,
        "event_starting_60m",
        new Date(startMs - 60 * MS_MIN),
        `Coming up: ${event.title}`,
        "Within one hour of scheduled start.",
        nowIso
      );
    }

    let report: BroadcastLaunchReadinessReport | null = null;
    if (m <= 24 * 60) {
      report = await getBroadcastLaunchReadinessReportForEvent(userId, event.id);
    }

    if (report?.overallStatus === "blocked") {
      pushTimeBucket(
        out,
        userId,
        event,
        "readiness_blocked",
        now,
        `Launch blocked: ${event.title}`,
        "Resolve readiness issues before go-live.",
        nowIso
      );
    } else if (report?.overallStatus === "attention_needed") {
      pushTimeBucket(
        out,
        userId,
        event,
        "readiness_attention",
        now,
        `Launch needs attention: ${event.title}`,
        "Review readiness checklist in the broadcast panel.",
        nowIso
      );
    }
  }

  const seen = new Set<string>();
  return out.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export async function listUpcomingBroadcastRemindersForUser(
  userId: number,
  nowIso: string,
  options?: { horizonHours?: number }
): Promise<BroadcastReminderItem[]> {
  return buildReminderItemsForUpcomingEvents(userId, nowIso, options);
}
