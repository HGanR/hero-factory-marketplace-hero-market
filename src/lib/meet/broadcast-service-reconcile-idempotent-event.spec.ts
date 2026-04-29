/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { reconcileIdempotentSessionBroadcastEvent } from "./broadcast-service";
import { getBroadcastEventById } from "./broadcast-event-store";

jest.mock("./broadcast-event-store", () => ({
  getBroadcastEventById: jest.fn(),
}));

jest.mock("./broadcast-audit", () => ({
  broadcastAudit: jest.fn(),
}));

jest.mock("./broadcast-metrics", () => {
  const actual = jest.requireActual("./broadcast-metrics") as Record<string, unknown>;
  return {
    ...actual,
    incrementBroadcastEventIdempotentAttach: jest.fn(),
    incrementBroadcastEventIdempotentAttachConflict: jest.fn(),
  };
});

const mockGetEvent = getBroadcastEventById as jest.MockedFunction<typeof getBroadcastEventById>;

function baseSession(
  overrides: Partial<typeof meetBroadcastSessions.$inferSelect> = {}
): typeof meetBroadcastSessions.$inferSelect {
  const now = new Date();
  return {
    id: 10,
    roomId: "room-a",
    userId: 99,
    livekitEgressId: "eg_x",
    status: "active",
    startedAt: now,
    endedAt: null,
    layoutMode: "grid",
    recordingEnabled: false,
    sceneConfigJson: null,
    compositorMode: "v2_rendered_template",
    renderSessionId: 1,
    compositorFallbackFromV2: false,
    broadcastEventId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDb() {
  const where = jest.fn().mockResolvedValue(undefined);
  const set = jest.fn().mockReturnValue({ where });
  const update = jest.fn().mockReturnValue({ set });
  return { update, set, where };
}

describe("reconcileIdempotentSessionBroadcastEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetEvent.mockResolvedValue({
      id: 7,
      userId: 99,
      title: "E",
      description: null,
      scheduledStartIso: "2026-06-01T12:00:00.000Z",
      scheduledEndIso: null,
      timezone: null,
      roomId: "room-a",
      status: "scheduled",
      scenePresetId: null,
      defaultTimelineTemplateId: null,
      createdAtIso: "2026-01-01T00:00:00.000Z",
      updatedAtIso: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns skipped when broadcastEventId is absent", async () => {
    const db = makeDb();
    const r = await reconcileIdempotentSessionBroadcastEvent(db as never, {
      session: baseSession(),
      broadcastEventId: null,
      userId: 99,
      roomId: "room-a",
    });
    expect(r.kind).toBe("skipped");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("attaches when session has no broadcastEventId", async () => {
    const db = makeDb();
    const r = await reconcileIdempotentSessionBroadcastEvent(db as never, {
      session: baseSession({ broadcastEventId: null }),
      broadcastEventId: 7,
      userId: 99,
      roomId: "room-a",
    });
    expect(r.kind).toBe("attached");
    expect(db.update).toHaveBeenCalled();
  });

  it("returns already_attached when ids match", async () => {
    const db = makeDb();
    const r = await reconcileIdempotentSessionBroadcastEvent(db as never, {
      session: baseSession({ broadcastEventId: 7 }),
      broadcastEventId: 7,
      userId: 99,
      roomId: "room-a",
    });
    expect(r.kind).toBe("already_attached");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns conflict when session has a different event", async () => {
    const db = makeDb();
    const r = await reconcileIdempotentSessionBroadcastEvent(db as never, {
      session: baseSession({ broadcastEventId: 3 }),
      broadcastEventId: 7,
      userId: 99,
      roomId: "room-a",
    });
    expect(r.kind).toBe("conflict");
    if (r.kind === "conflict") {
      expect(r.existingEventId).toBe(3);
      expect(r.requestedEventId).toBe(7);
    }
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns skipped when session is not live", async () => {
    const db = makeDb();
    const r = await reconcileIdempotentSessionBroadcastEvent(db as never, {
      session: baseSession({ status: "ended" }),
      broadcastEventId: 7,
      userId: 99,
      roomId: "room-a",
    });
    expect(r.kind).toBe("skipped");
    expect(db.update).not.toHaveBeenCalled();
  });

  it("returns skipped when room does not match session", async () => {
    const db = makeDb();
    const r = await reconcileIdempotentSessionBroadcastEvent(db as never, {
      session: baseSession(),
      broadcastEventId: 7,
      userId: 99,
      roomId: "other-room",
    });
    expect(r.kind).toBe("skipped");
  });
});
