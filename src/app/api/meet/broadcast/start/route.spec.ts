/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { POST } from "./route";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertMeetBroadcastHost } from "@/lib/meet/broadcast-host";
import { startMeetBroadcastSession } from "@/lib/meet/broadcast-service";
import { getDefaultSceneConfig } from "@/lib/meet/broadcast-scene";
import { resolveBroadcastStartScene } from "@/lib/meet/broadcast-start-scene";
import { getBroadcastEventById } from "@/lib/meet/broadcast-event-store";
import { getTimelineTemplateById } from "@/lib/meet/broadcast-timeline-templates";
import { BROADCAST_CODES } from "@/lib/meet/broadcast-codes";

const EPHEMERAL_IGNORED_REASON = BROADCAST_CODES.ephemeralIgnoredIdempotentActiveSession;
jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));
jest.mock("@/lib/meet/broadcast-host", () => ({
  assertMeetBroadcastHost: jest.fn(),
}));
jest.mock("@/lib/meet/broadcast-service", () => ({
  startMeetBroadcastSession: jest.fn(),
}));
jest.mock("@/lib/meet/broadcast-start-scene", () => ({
  resolveBroadcastStartScene: jest.fn(),
}));
jest.mock("@/lib/streaming/livekit-egress", () => ({
  livekitHttpHostFromEnv: jest.fn(() => "https://example.com"),
}));

jest.mock("@/lib/meet/broadcast-event-store", () => ({
  getBroadcastEventById: jest.fn(),
}));

jest.mock("@/lib/meet/broadcast-timeline-templates", () => ({
  getTimelineTemplateById: jest.fn(),
}));

const mockUser = getAuthedUserId as jest.MockedFunction<typeof getAuthedUserId>;
const mockHost = assertMeetBroadcastHost as jest.MockedFunction<typeof assertMeetBroadcastHost>;
const mockStart = startMeetBroadcastSession as jest.MockedFunction<typeof startMeetBroadcastSession>;
const mockResolveScene = resolveBroadcastStartScene as jest.MockedFunction<typeof resolveBroadcastStartScene>;
const mockGetEvent = getBroadcastEventById as jest.MockedFunction<typeof getBroadcastEventById>;
const mockGetTpl = getTimelineTemplateById as jest.MockedFunction<typeof getTimelineTemplateById>;

describe("POST /api/meet/broadcast/start", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STREAM_DESTINATION_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    process.env.LIVEKIT_API_KEY = "k";
    process.env.LIVEKIT_API_SECRET = "s";
    jest.spyOn(console, "error").mockImplementation(() => {});
    const snap = { ...getDefaultSceneConfig(), appliedPresetId: null as number | null, appliedPresetName: null as string | null };
    mockResolveScene.mockResolvedValue({
      snapshot: snap,
      liveKitLayout: "grid",
      rtmpMeetingLayout: "grid",
      egressMappingWarnings: [],
      resolveWarnings: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockUser.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "r1" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 when host wallet mismatches", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: "Wallet mismatch",
      code: "broadcast_host_mismatch",
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "r1", hostWallet: "0xabc" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("broadcast_host_mismatch");
  });

  it("forwards savedDestinationIds and ephemeralRtmp to startMeetBroadcastSession", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockStart.mockResolvedValueOnce({
      sessionId: 9,
      egressId: "EG_eph",
      destinations: [
        {
          streamDestinationId: null,
          platform: "instagram",
          label: "IG",
          finalOutputUrl: "",
          maskedUrl: "rtmps://…/****1234",
          warnings: [],
        },
      ],
      sceneSnapshot: { ...getDefaultSceneConfig(), appliedPresetId: null, appliedPresetName: null },
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({
        roomId: "room-a",
        savedDestinationIds: [],
        ephemeralRtmp: {
          serverUrl: "",
          streamKey: "live_ig_key",
          platform: "instagram",
          label: "IG",
        },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ephemeralRtmpIgnored?: boolean; idempotent?: boolean };
    expect(body.idempotent).toBeFalsy();
    expect(body.ephemeralRtmpIgnored).toBeUndefined();
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        savedDestinationIds: [],
        ephemeralRtmp: expect.objectContaining({
          streamKey: "live_ig_key",
          platform: "instagram",
        }),
      })
    );
  });

  it("returns ephemeralRtmpIgnored when idempotent and request included ephemeralRtmp", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockStart.mockResolvedValueOnce({
      sessionId: 3,
      egressId: "EG_same",
      destinations: [],
      idempotent: true,
      sceneSnapshot: { ...getDefaultSceneConfig(), appliedPresetId: null, appliedPresetName: null },
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({
        roomId: "room-a",
        savedDestinationIds: [],
        ephemeralRtmp: { streamKey: "live_new", platform: "instagram", serverUrl: "" },
      }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      idempotent?: boolean;
      ephemeralRtmpIgnored?: boolean;
      ephemeralRtmpIgnoredReason?: string;
    };
    expect(body.idempotent).toBe(true);
    expect(body.ephemeralRtmpIgnored).toBe(true);
    expect(body.ephemeralRtmpIgnoredReason).toBe(EPHEMERAL_IGNORED_REASON);
  });

  it("returns 503 when service reports broadcast_encryption_unconfigured", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    const err = new Error("Saved destinations require encryption key.");
    (err as Error & { code?: string }).code = "broadcast_encryption_unconfigured";
    mockStart.mockRejectedValueOnce(err);
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "room-a" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("broadcast_encryption_unconfigured");
  });

  it("returns session and egress when start succeeds", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockStart.mockResolvedValueOnce({
      sessionId: 9,
      egressId: "EG_x",
      destinations: [
        {
          streamDestinationId: 1,
          platform: "twitch",
          label: "A",
          finalOutputUrl: "rtmp://x",
          maskedUrl: "rtmp://x/****1234",
          warnings: [],
        },
      ],
      sceneSnapshot: { ...getDefaultSceneConfig(), appliedPresetId: null, appliedPresetName: null },
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "room-a", layoutMode: "grid", hostWallet: "0x" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { egressId?: string; sessionId?: number };
    expect(body.egressId).toBe("EG_x");
    expect(body.sessionId).toBe(9);
  });

  it("returns 409 when another user is broadcasting", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    const busy = new Error("Another broadcaster already has an active session for this room.");
    (busy as Error & { code?: string }).code = "broadcast_room_busy";
    mockStart.mockRejectedValueOnce(busy);
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "room-a" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("broadcast_room_busy");
  });

  it("passes scenePresetId into scene resolution when provided", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockStart.mockResolvedValueOnce({
      sessionId: 1,
      egressId: "EG_1",
      destinations: [],
      sceneSnapshot: { ...getDefaultSceneConfig(), appliedPresetId: 2, appliedPresetName: "X" },
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "room-a", scenePresetId: 2 }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(mockResolveScene).toHaveBeenCalledWith(expect.objectContaining({ userId: 5, scenePresetId: 2 }));
  });

  it("returns 400 when scene resolution fails validation", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockResolveScene.mockRejectedValueOnce(Object.assign(new Error("invalid layout"), { code: "broadcast_scene_invalid" }));
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "room-a", sceneConfig: { layoutMode: "bad" } }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("broadcast_scene_invalid");
  });

  it("passes broadcastEventId and schedule seed when event links a timeline template", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockGetEvent.mockResolvedValueOnce({
      id: 3,
      userId: 5,
      title: "E",
      description: null,
      scheduledStartIso: "2026-01-01T12:00:00.000Z",
      scheduledEndIso: null,
      timezone: null,
      roomId: "live-room",
      status: "scheduled",
      scenePresetId: 9,
      defaultTimelineTemplateId: 7,
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
    });
    mockGetTpl.mockResolvedValueOnce({
      id: 7,
      userId: 5,
      name: "Default ROS",
      template: {
        countdown: { visible: true, targetOffsetMsFromEventStart: 0 },
        relativeActions: [],
        automationEnabled: true,
      },
      isDefault: false,
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
    });
    const snap = { ...getDefaultSceneConfig(), appliedPresetId: null as number | null, appliedPresetName: null as string | null };
    mockStart.mockResolvedValueOnce({
      sessionId: 1,
      egressId: "EG_1",
      destinations: [],
      sceneSnapshot: snap,
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "live-room", broadcastEventId: 3 }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(mockStart).toHaveBeenCalledWith(
      expect.objectContaining({
        broadcastEventId: 3,
        scheduleSeedFromTimeline: expect.objectContaining({
          eventStartIso: "2026-01-01T12:00:00.000Z",
        }),
      })
    );
  });

  it("does not apply event scene preset when request includes explicit sceneConfig", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockGetEvent.mockResolvedValueOnce({
      id: 3,
      userId: 5,
      title: "E",
      description: null,
      scheduledStartIso: "2026-01-01T12:00:00.000Z",
      scheduledEndIso: null,
      timezone: null,
      roomId: "live-room",
      status: "scheduled",
      scenePresetId: 9,
      defaultTimelineTemplateId: null,
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
    });
    mockStart.mockResolvedValueOnce({
      sessionId: 1,
      egressId: "EG_1",
      destinations: [],
      sceneSnapshot: { ...getDefaultSceneConfig(), appliedPresetId: null, appliedPresetName: null },
    });
    const cfg = getDefaultSceneConfig();
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "live-room", broadcastEventId: 3, sceneConfig: cfg }),
    });
    await POST(req as never);
    expect(mockResolveScene).toHaveBeenCalledWith(
      expect.objectContaining({
        scenePresetId: null,
        sceneConfig: cfg,
      })
    );
  });

  it("returns idempotent when start service reports existing session", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockStart.mockResolvedValueOnce({
      sessionId: 3,
      egressId: "EG_same",
      destinations: [],
      idempotent: true,
      sceneSnapshot: { ...getDefaultSceneConfig(), appliedPresetId: null, appliedPresetName: null },
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "room-a" }),
    });
    const res = await POST(req as never);
    const body = (await res.json()) as {
      idempotent?: boolean;
      broadcastEventAttachment?: string | null;
      ephemeralRtmpIgnored?: boolean;
    };
    expect(res.status).toBe(200);
    expect(body.idempotent).toBe(true);
    expect(body.broadcastEventAttachment ?? null).toBeNull();
    expect(body.ephemeralRtmpIgnored).toBeUndefined();
  });

  it("returns broadcastEventAttachment when idempotent service includes it", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockGetEvent.mockResolvedValueOnce({
      id: 9,
      userId: 5,
      title: "E",
      description: null,
      scheduledStartIso: "2026-01-01T12:00:00.000Z",
      scheduledEndIso: null,
      timezone: null,
      roomId: "room-a",
      status: "scheduled",
      scenePresetId: null,
      defaultTimelineTemplateId: null,
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
    });
    const snap = { ...getDefaultSceneConfig(), appliedPresetId: null as number | null, appliedPresetName: null as string | null };
    mockStart.mockResolvedValueOnce({
      sessionId: 3,
      egressId: "EG_same",
      destinations: [],
      idempotent: true,
      sceneSnapshot: snap,
      broadcastEventAttachment: "attached",
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "room-a", broadcastEventId: 9 }),
    });
    const res = await POST(req as never);
    const body = (await res.json()) as { broadcastEventAttachment?: string; code?: string };
    expect(res.status).toBe(200);
    expect(body.broadcastEventAttachment).toBe("attached");
    expect(body.code).toBe(BROADCAST_CODES.ok);
  });

  it("returns broadcast_event_idempotent_conflict code when service reports event conflict", async () => {
    mockUser.mockResolvedValueOnce(5);
    mockHost.mockResolvedValueOnce({ ok: true });
    mockGetEvent.mockResolvedValueOnce({
      id: 9,
      userId: 5,
      title: "E",
      description: null,
      scheduledStartIso: "2026-01-01T12:00:00.000Z",
      scheduledEndIso: null,
      timezone: null,
      roomId: "room-a",
      status: "scheduled",
      scenePresetId: null,
      defaultTimelineTemplateId: null,
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
    });
    const snap = { ...getDefaultSceneConfig(), appliedPresetId: null as number | null, appliedPresetName: null as string | null };
    mockStart.mockResolvedValueOnce({
      sessionId: 3,
      egressId: "EG_same",
      destinations: [],
      idempotent: true,
      sceneSnapshot: snap,
      broadcastEventAttachment: "conflict",
      broadcastEventConflict: { existingEventId: 1, requestedEventId: 9 },
    });
    const req = new Request("http://localhost/api/meet/broadcast/start", {
      method: "POST",
      body: JSON.stringify({ roomId: "room-a", broadcastEventId: 9 }),
    });
    const res = await POST(req as never);
    const body = (await res.json()) as {
      code?: string;
      broadcastEventAttachment?: string;
      broadcastEventConflict?: { existingEventId: number };
    };
    expect(res.status).toBe(200);
    expect(body.code).toBe(BROADCAST_CODES.broadcastEventIdempotentConflict);
    expect(body.broadcastEventAttachment).toBe("conflict");
    expect(body.broadcastEventConflict?.existingEventId).toBe(1);
  });
});
