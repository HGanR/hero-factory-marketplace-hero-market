/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  maybeTrackLastSeenRealtimeEvent,
  normalizeRealtimeEnvelope,
  shouldIgnoreDuplicateRealtimeEvent,
} from "./broadcast-realtime-delivery";

describe("broadcast-realtime-delivery", () => {
  it("normalizeRealtimeEnvelope accepts valid shapes", () => {
    const n = normalizeRealtimeEnvelope({
      id: "a",
      type: "live_scene_updated",
      broadcastSessionId: "9",
      roomId: "r1",
      atIso: new Date().toISOString(),
      payload: { x: 1 },
    });
    expect(n?.id).toBe("a");
  });

  it("dedupe helpers track ids", () => {
    const seen = new Set<string>();
    expect(shouldIgnoreDuplicateRealtimeEvent(seen, "x")).toBe(false);
    maybeTrackLastSeenRealtimeEvent(seen, "x");
    expect(shouldIgnoreDuplicateRealtimeEvent(seen, "x")).toBe(true);
  });
});
