/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";
import { getDefaultBroadcastScheduleState } from "@/lib/meet/broadcast-schedule";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(async () => 100),
}));

jest.mock("@/lib/meet/broadcast-host", () => ({
  assertMeetBroadcastHost: jest.fn(async () => ({ ok: true as const })),
}));

jest.mock("@/lib/db", () => ({
  getDb: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-schedule-store", () => ({
  getBroadcastScheduleState: jest.fn(),
  upsertBroadcastScheduleState: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-scheduler", () => ({
  evaluateBroadcastScheduleForActiveSession: jest.fn(),
}));

import { getDb } from "@/lib/db";
import { getBroadcastScheduleState, upsertBroadcastScheduleState } from "@/lib/meet/broadcast-schedule-store";
import { evaluateBroadcastScheduleForActiveSession } from "@/lib/meet/broadcast-scheduler";

const v2SessionRow = {
  id: 55,
  userId: 100,
  roomId: "r1",
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

describe("/api/meet/broadcast/schedule", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET returns scheduleInvalid for bad id", async () => {
    const req = new NextRequest("http://localhost/api/meet/broadcast/schedule?broadcastSessionId=abc");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.scheduleInvalid);
  });

  it("GET returns scheduleSessionNotFound when missing", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost/api/meet/broadcast/schedule?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(404);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.scheduleSessionNotFound);
  });

  it("GET returns evaluated schedule for V2 host", async () => {
    const sched = getDefaultBroadcastScheduleState(55, 100);
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([v2SessionRow]),
          }),
        }),
      }),
    });
    (evaluateBroadcastScheduleForActiveSession as jest.Mock).mockResolvedValueOnce({
      schedule: sched,
      executedCount: 0,
    });
    (getBroadcastScheduleState as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/meet/broadcast/schedule?broadcastSessionId=55");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok?: boolean; persisted?: boolean; state?: { broadcastSessionId?: number } };
    expect(j.ok).toBe(true);
    expect(j.state?.broadcastSessionId).toBe(55);
    expect(j.persisted).toBe(false);
  });

  it("POST returns scheduleInvalid for empty patch", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([v2SessionRow]),
          }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost/api/meet/broadcast/schedule", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.scheduleInvalid);
  });

  it("POST returns scheduleHostMismatch for wrong owner", async () => {
    (getDb as jest.Mock).mockResolvedValueOnce({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve([
                {
                  ...v2SessionRow,
                  userId: 999,
                },
              ]),
          }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost/api/meet/broadcast/schedule", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, automationEnabled: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const j = (await res.json()) as { code?: string };
    expect(j.code).toBe(BROADCAST_CODES.scheduleHostMismatch);
  });

  it("POST upserts automation flag when V2 active", async () => {
    (getDb as jest.Mock).mockResolvedValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([v2SessionRow]),
          }),
        }),
      }),
    });
    (getBroadcastScheduleState as jest.Mock).mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost/api/meet/broadcast/schedule", {
      method: "POST",
      body: JSON.stringify({ broadcastSessionId: 55, automationEnabled: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const j = (await res.json()) as { ok?: boolean; state?: { automationEnabled?: boolean } };
    expect(j.ok).toBe(true);
    expect(j.state?.automationEnabled).toBe(true);
    expect(upsertBroadcastScheduleState).toHaveBeenCalled();
  });
});
