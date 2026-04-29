/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildBroadcastAnalyticsBreakdowns,
  buildBroadcastAnalyticsDashboard,
  normalizeBroadcastAnalyticsFilters,
  parseBroadcastAnalyticsFiltersFromSearchParams,
  type BroadcastDashboardSessionFact,
} from "./broadcast-analytics-dashboard";
import type { MeetBroadcastSessionRow } from "@/lib/db/schema";

function baseSession(partial: Partial<MeetBroadcastSessionRow> = {}): MeetBroadcastSessionRow {
  return {
    id: 1,
    roomId: "r1",
    userId: 10,
    livekitEgressId: "",
    status: "ended",
    startedAt: new Date("2026-04-01T12:00:00Z"),
    endedAt: new Date("2026-04-01T13:00:00Z"),
    layoutMode: "grid",
    recordingEnabled: false,
    sceneConfigJson: null,
    compositorMode: "v1_livekit_default",
    renderSessionId: null,
    compositorFallbackFromV2: false,
    broadcastEventId: null,
    createdAt: new Date("2026-04-01T11:00:00Z"),
    updatedAt: new Date("2026-04-01T13:00:00Z"),
    ...partial,
  };
}

function baseFact(partial: Partial<BroadcastDashboardSessionFact> = {}): BroadcastDashboardSessionFact {
  return {
    session: baseSession(),
    destinationCount: 1,
    failedDestinationCount: 0,
    failedDestinationsByPlatform: {},
    timelineCounts: {},
    broadcastEventId: null,
    broadcastEventTitle: null,
    timelineTemplateName: null,
    hasCalendarLink: false,
    autoDirectingMode: null,
    durationSeconds: 3600,
    anchorDayUtc: "2026-04-01",
    ...partial,
  };
}

describe("broadcast-analytics-dashboard", () => {
  it("parseBroadcastAnalyticsFiltersFromSearchParams rejects bad range", () => {
    const sp = new URLSearchParams({ range: "invalid" });
    const r = parseBroadcastAnalyticsFiltersFromSearchParams(sp, { allowUserIdFilter: false });
    expect(r.ok).toBe(false);
  });

  it("parseBroadcastAnalyticsFiltersFromSearchParams ignores userId when disabled", () => {
    const sp = new URLSearchParams({ range: "last_7_days", userId: "99" });
    const r = parseBroadcastAnalyticsFiltersFromSearchParams(sp, { allowUserIdFilter: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.filters.userId).toBeUndefined();
  });

  it("normalizeBroadcastAnalyticsFilters rejects long custom span", () => {
    const from = new Date("2026-01-01T00:00:00Z").toISOString();
    const to = new Date("2026-06-01T00:00:00Z").toISOString();
    const n = normalizeBroadcastAnalyticsFilters({ dateRange: "custom", fromIso: from, toIso: to });
    expect(n.ok).toBe(false);
  });

  it("buildBroadcastAnalyticsDashboard aggregates counts", () => {
    const facts: BroadcastDashboardSessionFact[] = [
      baseFact({
        session: baseSession({ id: 1, status: "active", compositorMode: "v2_rendered_template", compositorFallbackFromV2: true }),
        timelineCounts: {
          degraded_entered: 1,
          auto_directing_applied: 2,
          schedule_action_executed: 3,
          overlay_changed: 1,
          live_scene_changed: 1,
        },
        broadcastEventId: 5,
        hasCalendarLink: true,
      }),
      baseFact({
        session: baseSession({ id: 2, status: "ended", endedAt: new Date("2026-04-02T14:00:00Z") }),
        failedDestinationCount: 1,
        failedDestinationsByPlatform: { twitch: 1 },
        durationSeconds: 60,
      }),
    ];
    const s = buildBroadcastAnalyticsDashboard(facts);
    expect(s.totalSessions).toBe(2);
    expect(s.liveSessions).toBe(1);
    expect(s.completedSessions).toBe(1);
    expect(s.degradedSessionCount).toBe(1);
    expect(s.v2SessionCount).toBe(1);
    expect(s.v2FallbackCount).toBe(1);
    expect(s.autoDirectingApplyCount).toBe(2);
    expect(s.scheduleActionCount).toBe(3);
    expect(s.broadcastEventLinkedCount).toBe(1);
    expect(s.calendarLinkedCount).toBe(1);
    expect(s.totalFailedDestinations).toBe(1);
  });

  it("buildBroadcastAnalyticsBreakdowns builds sessionsByDay and failures", () => {
    const facts: BroadcastDashboardSessionFact[] = [
      baseFact({ anchorDayUtc: "2026-04-01", failedDestinationsByPlatform: { twitch: 2 } }),
      baseFact({ anchorDayUtc: "2026-04-01" }),
      baseFact({
        anchorDayUtc: "2026-04-02",
        session: baseSession({ compositorMode: "v2_rendered_template" }),
        broadcastEventId: 1,
        timelineTemplateName: "Show A",
        autoDirectingMode: "auto_apply",
      }),
    ];
    const b = buildBroadcastAnalyticsBreakdowns(facts);
    expect(b.sessionsByDay.find((d) => d.day === "2026-04-01")?.count).toBe(2);
    expect(b.destinationFailuresByPlatform.twitch).toBe(2);
    expect(b.eventLinkedVsManual.linked).toBe(1);
    expect(b.timelineTemplateUsage["Show A"]).toBe(1);
    expect(b.autoDirectingModeUsage.auto_apply).toBe(1);
  });
});
