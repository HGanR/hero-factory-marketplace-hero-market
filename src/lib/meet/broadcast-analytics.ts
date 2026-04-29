import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastSessionDestinations, meetBroadcastSessions, type MeetBroadcastSessionRow } from "@/lib/db/schema";
import type { BroadcastTimelineEvent, BroadcastTimelineEventType } from "./broadcast-timeline";
import { buildBroadcastTimelineSummary, listBroadcastTimelineEvents } from "./broadcast-timeline-store";
import { getBroadcastEventById } from "./broadcast-event-store";
import { getTimelineTemplateById } from "./broadcast-timeline-templates";
import { toBroadcastCalendarLinkSummary, type BroadcastCalendarLinkSummary } from "./broadcast-calendar-sync";
import { getBroadcastCalendarLinkByBroadcastEventId } from "./broadcast-calendar-link-store";
import { getBroadcastShowPackageById } from "./broadcast-show-package-store";

export type BroadcastSessionAnalyticsSummary = {
  sessionId: number;
  roomId: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  destinationCount: number;
  failedDestinationCount: number;
  degradedCount: number;
  liveSceneChangeCount: number;
  overlayChangeCount: number;
  countdownActionCount: number;
  scheduleActionCount: number;
  autoDirectingDecisionCount: number;
  autoDirectingApplyCount: number;
  compositorMode: string;
  compositorFallbackFromV2: boolean;
  broadcastEventId: number | null;
  broadcastEventTitle: string | null;
  showPackageId: number | null;
  showPackageName: string | null;
  timelineTemplateName: string | null;
  finalStatus: string;
  timelineEventCount: number;
  timelineSummary: Awaited<ReturnType<typeof buildBroadcastTimelineSummary>>;
  calendarLink: BroadcastCalendarLinkSummary | null;
};

function countType(events: BroadcastTimelineEvent[], t: BroadcastTimelineEventType): number {
  return events.filter((e) => e.eventType === t).length;
}

export async function buildBroadcastSessionAnalyticsSummary(
  session: MeetBroadcastSessionRow,
  options?: {
    broadcastEventTitle?: string | null;
    showPackageId?: number | null;
    showPackageName?: string | null;
    timelineTemplateName?: string | null;
    calendarLink?: BroadcastCalendarLinkSummary | null;
    /** When omitted, loads up to 2000 timeline rows for counting. */
    timelineEvents?: BroadcastTimelineEvent[];
  }
): Promise<BroadcastSessionAnalyticsSummary> {
  const db = await getDb();
  const destRows = await db
    .select()
    .from(meetBroadcastSessionDestinations)
    .where(eq(meetBroadcastSessionDestinations.broadcastSessionId, session.id));

  const events =
    options?.timelineEvents ??
    (await listBroadcastTimelineEvents(session.id, { limit: 2000 }));

  const timelineSummary = await buildBroadcastTimelineSummary(session.id);

  const started = session.startedAt ? new Date(session.startedAt).getTime() : null;
  const ended = session.endedAt ? new Date(session.endedAt).getTime() : null;
  let durationSeconds: number | null = null;
  if (started != null) {
    const endMs = ended ?? Date.now();
    durationSeconds = Math.max(0, Math.round((endMs - started) / 1000));
  }

  return {
    sessionId: session.id,
    roomId: session.roomId,
    startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
    endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : null,
    durationSeconds,
    destinationCount: destRows.length,
    failedDestinationCount: destRows.filter((d) => d.status === "failed").length,
    degradedCount: countType(events, "degraded_entered"),
    liveSceneChangeCount: countType(events, "live_scene_changed"),
    overlayChangeCount: countType(events, "overlay_changed"),
    countdownActionCount: countType(events, "countdown_started") + countType(events, "countdown_stopped"),
    scheduleActionCount: countType(events, "schedule_action_executed"),
    autoDirectingDecisionCount: countType(events, "auto_directing_decision"),
    autoDirectingApplyCount: countType(events, "auto_directing_applied"),
    compositorMode: session.compositorMode ?? "v1_livekit_default",
    compositorFallbackFromV2: Boolean(session.compositorFallbackFromV2),
    broadcastEventId: session.broadcastEventId ?? null,
    broadcastEventTitle: options?.broadcastEventTitle ?? null,
    showPackageId: options?.showPackageId ?? null,
    showPackageName: options?.showPackageName ?? null,
    timelineTemplateName: options?.timelineTemplateName ?? null,
    finalStatus: session.status,
    timelineEventCount: timelineSummary.totalEvents,
    timelineSummary,
    calendarLink: options?.calendarLink ?? null,
  };
}

export async function listRecentBroadcastAnalyticsForUser(
  userId: number,
  limit = 10
): Promise<BroadcastSessionAnalyticsSummary[]> {
  const db = await getDb();
  const cap = Math.min(25, Math.max(1, limit));
  const sessions = await db
    .select()
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.userId, userId))
    .orderBy(desc(meetBroadcastSessions.updatedAt))
    .limit(cap);

  const out: BroadcastSessionAnalyticsSummary[] = [];
  for (const s of sessions) {
    let broadcastEventTitle: string | null = null;
    let timelineTemplateName: string | null = null;
    const beId = s.broadcastEventId;
    let calendarLink: BroadcastCalendarLinkSummary | null = null;
    let showPackageId: number | null = null;
    let showPackageName: string | null = null;
    if (beId != null && Number.isFinite(Number(beId))) {
      const ev = await getBroadcastEventById(Number(beId), userId);
      if (ev) {
        broadcastEventTitle = ev.title;
        if (ev.defaultTimelineTemplateId != null) {
          const tt = await getTimelineTemplateById(ev.defaultTimelineTemplateId, userId);
          timelineTemplateName = tt?.name ?? null;
        }
        if (ev.showPackageId != null && Number.isFinite(Number(ev.showPackageId))) {
          showPackageId = Number(ev.showPackageId);
          const sp = await getBroadcastShowPackageById(showPackageId, userId);
          showPackageName = sp?.name ?? null;
        }
        const cal = await getBroadcastCalendarLinkByBroadcastEventId(ev.id, userId);
        calendarLink = cal ? toBroadcastCalendarLinkSummary(cal) : null;
      }
    }
    out.push(
      await buildBroadcastSessionAnalyticsSummary(s, {
        broadcastEventTitle,
        showPackageId,
        showPackageName,
        timelineTemplateName,
        calendarLink,
      })
    );
  }
  return out;
}
