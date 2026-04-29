import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { fetchMeetBroadcastSessionsForAdmin } from "@/lib/meet/broadcast-admin";
import { parseStoredSceneSnapshot } from "@/lib/meet/broadcast-scene";
import { isV2LiveSceneControlAvailable } from "@/lib/meet/broadcast-live-scenes";
import { getBroadcastLiveSceneStateMapForSessions } from "@/lib/meet/broadcast-live-scene-store";
import { getBroadcastOverlayStateMapForSessions } from "@/lib/meet/broadcast-overlay-store";
import { buildScheduleSummaryForStatus, getDefaultBroadcastScheduleState } from "@/lib/meet/broadcast-schedule";
import { getBroadcastScheduleStateMapForSessions } from "@/lib/meet/broadcast-schedule-store";
import { getBroadcastRealtimeAdapter } from "@/lib/meet/broadcast-realtime-adapter";
import { getBroadcastRealtimeBackendStatus } from "@/lib/meet/broadcast-realtime-health";
import {
  buildAutoDirectingPublicSummary,
  getBroadcastAutoDirectingState,
} from "@/lib/meet/broadcast-auto-directing-store";
import { getBroadcastEventById } from "@/lib/meet/broadcast-event-store";
import { getTimelineTemplateById } from "@/lib/meet/broadcast-timeline-templates";
import { getBroadcastTimelinePreviewForSession } from "@/lib/meet/broadcast-timeline-store";
import { toBroadcastCalendarLinkSummary } from "@/lib/meet/broadcast-calendar-sync";
import { getBroadcastCalendarLinkByBroadcastEventId } from "@/lib/meet/broadcast-calendar-link-store";

/**
 * GET /api/admin/meet-broadcast/sessions
 * Operator visibility — admin cookie only. No stream keys or raw RTMP URLs.
 *
 * Query: limit (default 50, max 100), status, roomId, userId
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized (missing admin token)" }, { status: 401 });
  }
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Unauthorized (not admin)" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const limitRaw = searchParams.get("limit");
  const status = searchParams.get("status")?.trim() || undefined;
  const roomId = searchParams.get("roomId")?.trim() || undefined;
  const userIdRaw = searchParams.get("userId")?.trim();
  const userId =
    userIdRaw !== undefined && userIdRaw !== "" && Number.isFinite(Number(userIdRaw))
      ? Number(userIdRaw)
      : undefined;

  try {
    const rows = await fetchMeetBroadcastSessionsForAdmin({
      limit: limitRaw ? Number(limitRaw) : undefined,
      status,
      roomId,
      userId,
    });

    const v2Ids = rows
      .filter(({ session }) => isV2LiveSceneControlAvailable(session))
      .map(({ session }) => session.id);
    const liveMap = await getBroadcastLiveSceneStateMapForSessions(v2Ids);
    const overlayMap = await getBroadcastOverlayStateMapForSessions(v2Ids);
    const scheduleMap = await getBroadcastScheduleStateMapForSessions(v2Ids);
    const nowIso = new Date().toISOString();
    const rtGlobal = await getBroadcastRealtimeBackendStatus();
    const rtAdapter = getBroadcastRealtimeAdapter();

    const sessions = await Promise.all(
      rows.map(async ({ session, destinations }) => {
        const sceneSnap = parseStoredSceneSnapshot(session.sceneConfigJson, session.layoutMode);
        const live = liveMap.get(session.id);
        const ov = overlayMap.get(session.id);
        const schedRow = scheduleMap.get(session.id);
        const schedEff =
          schedRow ?? getDefaultBroadcastScheduleState(session.id, session.userId);
        const scheduleSummary = isV2LiveSceneControlAvailable(session)
          ? buildScheduleSummaryForStatus(schedEff, nowIso)
          : null;
        const rtMeta = await rtAdapter.getSessionMeta(session.id);
        const adRow =
          isV2LiveSceneControlAvailable(session) ? await getBroadcastAutoDirectingState(session.id) : null;
        const autoDirectingSummary = buildAutoDirectingPublicSummary(adRow ?? null, nowIso);
        const timelinePreview = await getBroadcastTimelinePreviewForSession(session.id);

        const beId = session.broadcastEventId;
        let broadcastEventSummary: {
          id: number;
          title: string;
          scheduledStartIso: string;
          status: string;
          timelineTemplateName: string | null;
          launchedFromEvent: boolean;
        } | null = null;
        if (beId != null && Number.isFinite(Number(beId))) {
          const ev = await getBroadcastEventById(Number(beId), session.userId);
          if (ev) {
            let timelineTemplateName: string | null = null;
            if (ev.defaultTimelineTemplateId != null) {
              const tt = await getTimelineTemplateById(ev.defaultTimelineTemplateId, session.userId);
              timelineTemplateName = tt?.name ?? null;
            }
            const cal = await getBroadcastCalendarLinkByBroadcastEventId(ev.id, session.userId);
            broadcastEventSummary = {
              id: ev.id,
              title: ev.title,
              scheduledStartIso: ev.scheduledStartIso,
              status: ev.status,
              timelineTemplateName,
              launchedFromEvent: true,
              calendarLink: cal ? toBroadcastCalendarLinkSummary(cal) : null,
            };
          }
        }

        return {
          session: {
            id: session.id,
            roomId: session.roomId,
            userId: session.userId,
            livekitEgressId: session.livekitEgressId,
            status: session.status,
            layoutMode: session.layoutMode,
            recordingEnabled: Boolean(session.recordingEnabled),
            sceneConfigJson: session.sceneConfigJson ?? null,
            compositorMode: session.compositorMode ?? "v1_livekit_default",
            compositorFallbackFromV2: Boolean(session.compositorFallbackFromV2),
            renderSessionMasked:
              session.renderSessionId != null ? `rs_****${String(session.renderSessionId).slice(-2)}` : null,
            sceneLayoutSummary: sceneSnap.layoutMode,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            broadcastEventId: session.broadcastEventId ?? null,
            broadcastEventSummary,
            currentLiveSceneType: live?.sceneType ?? null,
            currentLiveLayoutMode: live?.layoutMode ?? null,
            liveSceneUpdatedAt: live?.updatedAt ?? null,
            overlaySummary:
              isV2LiveSceneControlAvailable(session) && ov
                ? {
                    lowerThirdVisible: ov.lowerThird.visible,
                    tickerVisible: ov.ticker.visible,
                    ctaBannerVisible: ov.ctaBanner.visible,
                  }
                : isV2LiveSceneControlAvailable(session)
                  ? {
                      lowerThirdVisible: false,
                      tickerVisible: false,
                      ctaBannerVisible: false,
                    }
                  : null,
            overlayUpdatedAt: isV2LiveSceneControlAvailable(session) ? (ov?.updatedAt ?? null) : null,
            scheduleSummary,
            scheduleUpdatedAt: schedRow?.updatedAt ?? null,
            realtimeCapable: isV2LiveSceneControlAvailable(session),
            realtimeSubscriberCount: rtMeta.subscriberCount,
            realtimeLastEventAt: rtMeta.lastEventAtIso,
            realtimeBackend: rtGlobal.effective,
            realtimeBackendRequested: rtGlobal.requested,
            realtimeBackendHealthy: rtGlobal.healthy,
            realtimeBackendDetail: rtGlobal.detail ?? null,
            realtimeBackendFallbackActive: rtGlobal.fallbackActive,
            autoDirectingSummary,
            timelineEventCount: timelinePreview.eventCount,
            latestTimelineEvent: timelinePreview.latestEvent,
            analyticsSummaryPreview: {
              destinationCount: destinations.length,
              failedDestinationCount: destinations.filter((d) => d.status === "failed").length,
              timelineEventCount: timelinePreview.eventCount,
              compositorMode: session.compositorMode ?? "v1_livekit_default",
              compositorFallbackFromV2: Boolean(session.compositorFallbackFromV2),
            },
          },
          destinations: destinations.map((d) => ({
            id: d.id,
            streamDestinationId: d.streamDestinationId,
            platform: d.platform,
            label: d.label,
            resolvedOutputUrlMasked: d.resolvedOutputUrlMasked,
            status: d.status,
            lastError: d.lastError,
            startedAt: d.startedAt,
            endedAt: d.endedAt,
          })),
        };
      })
    );

    return NextResponse.json({
      ok: true,
      count: rows.length,
      realtime: {
        backend: rtGlobal.effective,
        backendRequested: rtGlobal.requested,
        backendHealthy: rtGlobal.healthy,
        backendDetail: rtGlobal.detail ?? null,
        fallbackActive: rtGlobal.fallbackActive,
      },
      sessions,
    });
  } catch (e) {
    console.error("[admin/meet-broadcast/sessions]", e);
    return NextResponse.json({ ok: false, error: "Failed to load sessions" }, { status: 503 });
  }
}
