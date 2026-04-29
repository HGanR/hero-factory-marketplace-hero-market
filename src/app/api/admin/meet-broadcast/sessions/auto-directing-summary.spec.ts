/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { verifyToken } from "@/lib/auth";
import { fetchMeetBroadcastSessionsForAdmin } from "@/lib/meet/broadcast-admin";
import { getDefaultBroadcastAutoDirectingPolicy } from "@/lib/meet/broadcast-auto-directing";

jest.mock("@/lib/auth", () => ({
  verifyToken: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-admin", () => ({
  fetchMeetBroadcastSessionsForAdmin: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-auto-directing-store", () => ({
  getBroadcastAutoDirectingState: jest.fn(),
  buildAutoDirectingPublicSummary: jest.requireActual("@/lib/meet/broadcast-auto-directing-store")
    .buildAutoDirectingPublicSummary,
}));

jest.mock("@/lib/meet/broadcast-live-scene-store", () => ({
  getBroadcastLiveSceneStateMapForSessions: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/meet/broadcast-overlay-store", () => ({
  getBroadcastOverlayStateMapForSessions: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/meet/broadcast-schedule-store", () => ({
  getBroadcastScheduleStateMapForSessions: jest.fn(async () => new Map()),
}));

jest.mock("@/lib/meet/broadcast-realtime-adapter", () => ({
  getBroadcastRealtimeAdapter: jest.fn(() => ({
    name: "memory" as const,
    health: jest.fn(async () => ({ ok: true, detail: undefined })),
    getSessionMeta: jest.fn(async () => ({ subscriberCount: 0, lastEventAtIso: null as string | null })),
    publish: jest.fn(async () => {}),
  })),
}));

jest.mock("@/lib/meet/broadcast-realtime-health", () => ({
  getBroadcastRealtimeBackendStatus: jest.fn(async () => ({
    requested: "memory" as const,
    effective: "memory" as const,
    healthy: true,
    detail: undefined,
    fallbackActive: false,
  })),
}));

import { getBroadcastAutoDirectingState } from "@/lib/meet/broadcast-auto-directing-store";

const mockVerify = verifyToken as jest.MockedFunction<typeof verifyToken>;
const mockFetch = fetchMeetBroadcastSessionsForAdmin as jest.MockedFunction<
  typeof fetchMeetBroadcastSessionsForAdmin
>;

function req(url: string) {
  return new NextRequest(url, { headers: { cookie: "admin-token=fakejwt" } });
}

describe("GET /api/admin/meet-broadcast/sessions autoDirectingSummary", () => {
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errSpy.mockRestore();
  });

  it("includes stable autoDirectingSummary for V2 sessions", async () => {
    mockVerify.mockReturnValueOnce({ isAdmin: true });
    const startedAt = new Date("2026-01-02T00:00:00.000Z");
    mockFetch.mockResolvedValueOnce([
      {
        session: {
          id: 88,
          roomId: "room-v2",
          userId: 42,
          livekitEgressId: "EG_1",
          status: "active",
          layoutMode: "grid",
          recordingEnabled: false,
          sceneConfigJson: null,
          compositorMode: "v2_rendered_template",
          renderSessionId: 7,
          compositorFallbackFromV2: false,
          startedAt,
          endedAt: null,
          createdAt: startedAt,
          updatedAt: startedAt,
        } as never,
        destinations: [],
      },
    ]);

    const pol = getDefaultBroadcastAutoDirectingPolicy();
    pol.mode = "suggest_only";
    (getBroadcastAutoDirectingState as jest.Mock).mockResolvedValue({
      policy: pol,
      lastDecision: {
        recommendedLayoutMode: "screenshare_focus" as const,
        reason: "admin_shape_test",
        confidence: "high" as const,
        shouldApply: true,
      },
      lastAppliedAt: null,
      lastAppliedLayoutMode: null,
      manualOverrideUntilIso: "2099-01-01T00:00:00.000Z",
      updatedByUserId: 42,
      debounce: { lastDominantSpeakerId: null, lastFlipAtIso: null },
    });

    const res = await GET(req("http://localhost/api/admin/meet-broadcast/sessions"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessions: Array<{
        session: {
          autoDirectingSummary: {
            mode: string;
            latestRecommendedLayout: string | null;
            latestReason: string | null;
            manualOverrideActive: boolean;
            lastAppliedAt: string | null;
          } | null;
        };
      }>;
    };
    const s = body.sessions[0].session.autoDirectingSummary;
    expect(s).not.toBeNull();
    expect(s!.mode).toBe("suggest_only");
    expect(s!.latestRecommendedLayout).toBe("screenshare_focus");
    expect(s!.latestReason).toBe("admin_shape_test");
    expect(s!.manualOverrideActive).toBe(true);
    expect(s!.lastAppliedAt).toBeNull();
  });
});
