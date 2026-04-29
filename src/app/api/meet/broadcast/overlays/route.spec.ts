/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(async () => 100),
}));

jest.mock("@/lib/meet/broadcast-host", () => ({
  assertMeetBroadcastHost: jest.fn(async () => ({ ok: true as const })),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-overlay-store", () => ({
  getBroadcastOverlayState: jest.fn(async () => null),
  upsertBroadcastOverlayState: jest.fn(async () => {}),
}));

jest.mock("@/lib/meet/broadcast-overlay-pack-store", () => ({
  getBroadcastOverlayPackById: jest.fn(async () => null),
  recordBroadcastOverlayPackApplied: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-guest-card-pack-store", () => ({
  getBroadcastGuestCardPackById: jest.fn(async () => null),
  recordBroadcastGuestCardApplied: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-scheduler", () => ({
  evaluateBroadcastScheduleForActiveSession: jest.fn(async () => ({
    schedule: {
      broadcastSessionId: 55,
      countdown: { visible: false, position: "top_right" },
      actions: [],
      automationEnabled: false,
      updatedAt: new Date().toISOString(),
      updatedByUserId: 100,
    },
    executedCount: 0,
  })),
}));

import { getDb } from "@/lib/db";
import { getBroadcastOverlayState } from "@/lib/meet/broadcast-overlay-store";

describe("/api/meet/broadcast/overlays", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns overlayInvalid for bad id", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/overlays?broadcastSessionId=xx");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.overlayInvalid);
  });

  it("GET returns overlayNotSupported for V1 session", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 55,
                  userId: 100,
                  roomId: "r1",
                  status: "active",
                  layoutMode: "grid",
                  sceneConfigJson: null,
                  compositorMode: "v1_livekit_default",
                  renderSessionId: null,
                  compositorFallbackFromV2: false,
                },
              ]),
          }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost/api/meet/broadcast/overlays?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(409);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.overlayNotSupported);
  });

  it("POST upserts for V2 active session", async () => {
    (getDb as jest.Mock).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  id: 55,
                  userId: 100,
                  roomId: "r1",
                  status: "active",
                  layoutMode: "grid",
                  sceneConfigJson: null,
                  compositorMode: "v2_rendered_template",
                  renderSessionId: 1,
                  compositorFallbackFromV2: false,
                },
              ]),
          }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost/api/meet/broadcast/overlays", {
      method: "POST",
      body: JSON.stringify({
        broadcastSessionId: 55,
        lowerThird: { visible: true, headline: "Test" },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok?: boolean; state?: { lowerThird?: { headline?: string } } };
    expect(j.ok).toBe(true);
    expect(j.state?.lowerThird?.headline).toBe("Test");
    expect(getBroadcastOverlayState).toHaveBeenCalled();
  });
});
