/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

delete process.env.LIVEKIT_URL;

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-live-scene-store", () => ({
  getBroadcastLiveSceneState: jest.fn(async () => null),
}));

jest.mock("@/lib/meet/broadcast-overlay-store", () => ({
  getBroadcastOverlayState: jest.fn(async () => null),
}));

jest.mock("@/lib/meet/broadcast-scheduler", () => {
  const { getDefaultBroadcastScheduleState } = jest.requireActual("@/lib/meet/broadcast-schedule");
  return {
    evaluateBroadcastScheduleForActiveSession: jest.fn(async (session: { id: number; userId: number }) => ({
      schedule: getDefaultBroadcastScheduleState(session.id, session.userId),
      executedCount: 0,
    })),
  };
});

jest.mock("@/lib/meet/broadcast-auto-directing-engine", () => ({
  evaluateBroadcastAutoDirectingForActiveSession: jest.fn(async () => {}),
}));

jest.mock("@/lib/meet/broadcast-auto-directing-store", () => ({
  getBroadcastAutoDirectingState: jest.fn(),
  buildAutoDirectingPublicSummary: jest.requireActual("@/lib/meet/broadcast-auto-directing-store")
    .buildAutoDirectingPublicSummary,
}));

jest.mock("@/lib/meet/broadcast-timeline-store", () => ({
  getBroadcastTimelinePreviewForSession: jest.fn(async () => ({
    eventCount: 2,
    latestEvent: {
      summary: "Broadcast started (1 destination(s))",
      eventType: "session_started",
      eventAtIso: "2026-01-01T00:00:00.000Z",
    },
  })),
}));

import { getDb } from "@/lib/db";
import { getBroadcastAutoDirectingState } from "@/lib/meet/broadcast-auto-directing-store";
import { getMeetBroadcastStatus } from "@/lib/meet/broadcast-service";
import { getDefaultBroadcastAutoDirectingPolicy } from "@/lib/meet/broadcast-auto-directing";

function v2Session() {
  return {
    id: 501,
    roomId: "room-status-ad",
    userId: 100,
    status: "active",
    livekitEgressId: "eg_1",
    startedAt: new Date("2026-01-01T00:00:00.000Z"),
    endedAt: null,
    layoutMode: "grid",
    recordingEnabled: false,
    sceneConfigJson: null,
    compositorMode: "v2_rendered_template",
    renderSessionId: 9,
    compositorFallbackFromV2: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    broadcastEventId: null,
  };
}

describe("getMeetBroadcastStatus auto-directing enrichment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    let q = 0;
    (getDb as jest.Mock).mockImplementation(async () => ({
      select: () => ({
        from: () => ({
          where: () => {
            q += 1;
            if (q === 1) {
              return {
                orderBy: () => ({
                  limit: async () => [v2Session()],
                }),
              };
            }
            return Promise.resolve([]);
          },
        }),
      }),
    }));
  });

  afterEach(() => {
    delete process.env.LIVEKIT_URL;
  });

  it("exposes scenePreview.autoDirectingSummary for active V2 template", async () => {
    const pol = getDefaultBroadcastAutoDirectingPolicy();
    pol.mode = "auto_apply";
    (getBroadcastAutoDirectingState as jest.Mock).mockResolvedValue({
      policy: pol,
      lastDecision: {
        recommendedLayoutMode: "gallery" as const,
        reason: "status_test",
        confidence: "low" as const,
        shouldApply: false,
      },
      lastAppliedAt: "2026-01-02T00:00:00.000Z",
      lastAppliedLayoutMode: "speaker" as const,
      manualOverrideUntilIso: null,
      updatedByUserId: 100,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    });

    const out = await getMeetBroadcastStatus({ userId: 100, roomId: "room-status-ad" });
    expect(out.session).not.toBeNull();
    const summary = out.session!.scenePreview.autoDirectingSummary;
    expect(summary).not.toBeNull();
    expect(summary!.mode).toBe("auto_apply");
    expect(summary!.latestRecommendedLayout).toBe("gallery");
    expect(summary!.latestReason).toBe("status_test");
    expect(summary!.manualOverrideActive).toBe(false);
    expect(summary!.lastAppliedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(out.timelinePreview?.eventCount).toBe(2);
    expect(out.timelinePreview?.latestEvent?.eventType).toBe("session_started");
  });
});
