/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { buildBroadcastRealtimeEvent, validateBroadcastRealtimeEvent } from "./broadcast-realtime";

describe("broadcast-realtime", () => {
  it("validateBroadcastRealtimeEvent accepts built event", () => {
    const ev = buildBroadcastRealtimeEvent({
      type: "live_scene_updated",
      broadcastSessionId: 1,
      roomId: "r1",
      payload: { x: 1 },
    });
    const v = validateBroadcastRealtimeEvent(ev);
    expect(v.ok).toBe(true);
  });

  it("validateBroadcastRealtimeEvent rejects bad type", () => {
    const v = validateBroadcastRealtimeEvent({
      type: "nope",
      broadcastSessionId: 1,
      roomId: "r1",
      atIso: new Date().toISOString(),
      eventId: "e1",
      payload: {},
    });
    expect(v.ok).toBe(false);
  });
});
