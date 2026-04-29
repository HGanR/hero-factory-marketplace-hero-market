/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET } from "./route";

jest.mock("@/lib/meet/broadcast-render-sessions", () => ({
  getBroadcastRenderSessionByToken: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

import { getBroadcastRenderSessionByToken } from "@/lib/meet/broadcast-render-sessions";
import { getDb } from "@/lib/db";

const v2SessionRow = {
  id: 9,
  userId: 2,
  roomId: "room-x",
  status: "active",
  layoutMode: "grid",
  sceneConfigJson: null,
  compositorMode: "v2_rendered_template",
  renderSessionId: 1,
  compositorFallbackFromV2: false,
  livekitEgressId: "eg",
  recordingEnabled: false,
  startedAt: new Date(),
  endedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("GET /api/meet/broadcast/render-events", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 without token", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/render-events?rsid=1");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when render session invalid", async () => {
    (getBroadcastRenderSessionByToken as jest.Mock).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/meet/broadcast/render-events?rsid=1&token=bad");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("returns event-stream when token valid and V2 active", async () => {
    (getBroadcastRenderSessionByToken as jest.Mock).mockResolvedValueOnce({
      id: 1,
      broadcastSessionId: 9,
      userId: 2,
      accessToken: "tok",
      renderModelJson: {},
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([v2SessionRow]),
          }),
        }),
      }),
    });
    const ac = new AbortController();
    const req = new NextRequest("http://localhost/api/meet/broadcast/render-events?rsid=1&token=tok", {
      signal: ac.signal,
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value!)).toContain(": connected");
    ac.abort();
    await reader.cancel().catch(() => {});
  });
});
