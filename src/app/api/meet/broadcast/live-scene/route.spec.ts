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

jest.mock("@/lib/meet/broadcast-live-scene-store", () => ({
  getBroadcastLiveSceneState: jest.fn(async () => null),
  upsertBroadcastLiveSceneState: jest.fn(async () => {}),
}));

jest.mock("@/lib/meet/broadcast-auto-directing-override", () => ({
  recordOperatorManualLayoutOverride: jest.fn(async () => {}),
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
import { getBroadcastLiveSceneState } from "@/lib/meet/broadcast-live-scene-store";
import { recordOperatorManualLayoutOverride } from "@/lib/meet/broadcast-auto-directing-override";

describe("/api/meet/broadcast/live-scene", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns 400 for invalid broadcastSessionId", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/live-scene?broadcastSessionId=abc");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.liveSceneInvalid);
  });

  it("GET returns 404 when session missing", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost/api/meet/broadcast/live-scene?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(404);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.liveSceneSessionNotFound);
  });

  it("GET returns 409 when session not V2", async () => {
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
    const req = new NextRequest("http://localhost/api/meet/broadcast/live-scene?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(409);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.liveSceneNotSupported);
  });

  it("POST returns stable code when not active", async () => {
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
                  status: "ended",
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
    const req = new NextRequest("http://localhost/api/meet/broadcast/live-scene", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.liveSceneNotActive);
  });

  it("POST upserts when V2 active", async () => {
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
    const req = new NextRequest("http://localhost/api/meet/broadcast/live-scene", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, sceneType: "intro" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok?: boolean; state?: { sceneType?: string } };
    expect(j.ok).toBe(true);
    expect(j.state?.sceneType).toBe("intro");
    expect(getBroadcastLiveSceneState).toHaveBeenCalled();
  });

  it("POST calls recordOperatorManualLayoutOverride when layoutMode changes", async () => {
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
    const req = new NextRequest("http://localhost/api/meet/broadcast/live-scene", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, layoutMode: "speaker" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(recordOperatorManualLayoutOverride).toHaveBeenCalledWith(55, 100, "r1");
  });

  it("POST does not record manual override for sceneType-only patch", async () => {
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
    const req = new NextRequest("http://localhost/api/meet/broadcast/live-scene", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, sceneType: "brb" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(recordOperatorManualLayoutOverride).not.toHaveBeenCalled();
  });
});
