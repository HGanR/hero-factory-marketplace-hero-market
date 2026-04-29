/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { POST } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { stopMeetBroadcastSession } from "@/lib/meet/broadcast-service";

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));
jest.mock("@/lib/meet/broadcast-host", () => ({
  assertMeetBroadcastHost: jest.fn(),
}));
jest.mock("@/lib/meet/broadcast-service", () => ({
  stopMeetBroadcastSession: jest.fn(),
}));

const mockUser = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const mockHost = assertMeetBroadcastHost as jest.MockedFunction<typeof assertMeetBroadcastHost>;
const mockStop = stopMeetBroadcastSession as jest.MockedFunction<typeof stopMeetBroadcastSession>;

describe("POST /api/meet/broadcast/stop", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/meet/broadcast/stop", {
      method: "POST",
      body: JSON.stringify({ roomId: "r1" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns stopped false when no active session", async () => {
    mockUser.mockResolvedValueOnce(2);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockStop.mockResolvedValueOnce({ stopped: false, code: "broadcast_stop_noop" });
    const req = new Request("http://localhost/api/meet/broadcast/stop", {
      method: "POST",
      body: JSON.stringify({ roomId: "r1" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { stopped?: boolean; code?: string };
    expect(body.stopped).toBe(false);
    expect(body.code).toBe("broadcast_stop_noop");
  });

  it("returns stopped true after stopMeetBroadcastSession", async () => {
    mockUser.mockResolvedValueOnce(2);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockStop.mockResolvedValueOnce({ stopped: true, egressId: "e1" });
    const req = new Request("http://localhost/api/meet/broadcast/stop", {
      method: "POST",
      body: JSON.stringify({ roomId: "r1" }),
    });
    const res = await POST(req as never);
    const body = (await res.json()) as { stopped?: boolean; egressId?: string };
    expect(body.stopped).toBe(true);
    expect(body.egressId).toBe("e1");
  });
});
