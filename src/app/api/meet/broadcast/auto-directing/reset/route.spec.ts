/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "./route";
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

jest.mock("@/lib/meet/broadcast-auto-directing-store", () => ({
  resetBroadcastAutoDirectingState: jest.fn(async () => {}),
}));

jest.mock("@/lib/meet/broadcast-metrics", () => ({
  incrementBroadcastAutoDirectingChange: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-audit", () => ({
  broadcastAudit: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-event-publisher", () => ({
  publishAutoDirectingUpdated: jest.fn(),
}));

import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { resetBroadcastAutoDirectingState } from "@/lib/meet/broadcast-auto-directing-store";
import { incrementBroadcastAutoDirectingChange } from "@/lib/meet/broadcast-metrics";
import { publishAutoDirectingUpdated } from "@/lib/meet/broadcast-event-publisher";

function v2Session(overrides: Record<string, unknown> = {}) {
  return {
    id: 55,
    userId: 100,
    roomId: "r1",
    status: "active",
    layoutMode: "grid",
    sceneConfigJson: null,
    compositorMode: "v2_rendered_template",
    renderSessionId: 1,
    compositorFallbackFromV2: false,
    ...overrides,
  };
}

function dbMockForSession(session: unknown | null) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(session ? [session] : []),
        }),
      }),
    }),
  };
}

describe("POST /api/meet/broadcast/auto-directing/reset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthedUserId as jest.Mock).mockResolvedValue(100);
  });

  it("returns 401 when unauthenticated", async () => {
    (getAuthedUserId as jest.Mock).mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing/reset", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.notAuthenticated);
  });

  it("returns 400 invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing/reset", {
      method: "POST",
      body: "{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingInvalid);
  });

  it("returns 400 when broadcastSessionId missing", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing/reset", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingInvalid);
  });

  it("returns 404 session_not_found", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(null));
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing/reset", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingSessionNotFound);
  });

  it("returns 403 host_mismatch", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session({ userId: 2 })));
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing/reset", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingHostMismatch);
  });

  it("returns 409 not_active", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session({ status: "ended" })));
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing/reset", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingNotActive);
  });

  it("returns 409 not_supported for V1", async () => {
    (getDb as jest.Mock).mockResolvedValue(
      dbMockForSession(v2Session({ compositorMode: "v1_livekit_default", renderSessionId: null }))
    );
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing/reset", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe(BROADCAST_CODES.autoDirectingNotSupported);
  });

  it("returns ok true and resets store on success", async () => {
    (getDb as jest.Mock).mockResolvedValue(dbMockForSession(v2Session()));
    const req = new NextRequest("http://localhost/api/meet/broadcast/auto-directing/reset", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok: boolean };
    expect(j).toEqual({ ok: true });
    expect(resetBroadcastAutoDirectingState).toHaveBeenCalledWith(55, 100);
    expect(incrementBroadcastAutoDirectingChange).toHaveBeenCalled();
    expect(publishAutoDirectingUpdated).toHaveBeenCalledWith(55, "r1", expect.objectContaining({ reset: true }));
  });
});
