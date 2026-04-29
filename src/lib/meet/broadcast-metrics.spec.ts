/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals";
import {
  incrementBroadcastStartAttempt,
  incrementBroadcastStartSuccess,
  incrementBroadcastStartIdempotent,
  incrementBroadcastRoomBusy,
  incrementBroadcastPreflightFailure,
  incrementBroadcastEgressFailure,
  incrementBroadcastStop,
  incrementBroadcastStopNoop,
  incrementBroadcastReconciled,
  incrementBroadcastDegraded,
  incrementBroadcastCompositorV2Attempt,
  incrementBroadcastCompositorV2Fallback,
  incrementBroadcastCompositorV2Success,
  incrementBroadcastCompositorV2Failure,
  incrementBroadcastLiveSceneChange,
  incrementBroadcastLiveSceneReset,
  incrementBroadcastLiveSceneError,
  incrementBroadcastOverlayChange,
  incrementBroadcastOverlayReset,
  incrementBroadcastOverlayError,
  incrementBroadcastAutoDirectingApply,
  incrementBroadcastAutoDirectingChange,
  incrementBroadcastAutoDirectingDecision,
  incrementBroadcastAutoDirectingError,
  incrementBroadcastAutoDirectingPauseManualOverride,
  incrementBroadcastEventIdempotentAttach,
  incrementBroadcastEventIdempotentAttachConflict,
} from "./broadcast-metrics";

describe("broadcast-metrics", () => {
  let info: jest.SpyInstance;

  beforeEach(() => {
    info = jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    info.mockRestore();
  });

  function lastPayload(): Record<string, unknown> {
    const call = info.mock.calls[info.mock.calls.length - 1]?.[0] as string;
    return JSON.parse(call) as Record<string, unknown>;
  }

  it("emits structured JSON with metric name, ids, and timestamp", () => {
    incrementBroadcastStartAttempt({ userId: 7, roomId: "room-a", sessionId: null });
    const p = lastPayload();
    expect(p.component).toBe("meet_broadcast_metrics");
    expect(p.metric).toBe("broadcast_start_attempt");
    expect(p.userId).toBe(7);
    expect(p.roomId).toBe("room-a");
    expect(p.sessionId).toBeNull();
    expect(typeof p.timestamp).toBe("string");
    expect((p.timestamp as string).includes("T")).toBe(true);
  });

  it("emits compositor v2 metrics with optional reason", () => {
    incrementBroadcastCompositorV2Fallback({ userId: 1, roomId: "r", sessionId: 2, reason: "no_origin" });
    const p = lastPayload();
    expect(p.metric).toBe("broadcast_compositor_v2_fallback");
    expect(p.reason).toBe("no_origin");
    incrementBroadcastCompositorV2Attempt({ userId: 1, roomId: "r", sessionId: 2 });
    incrementBroadcastCompositorV2Success({ userId: 1, roomId: "r", sessionId: 2 });
    incrementBroadcastCompositorV2Failure({ userId: 1, roomId: "r", sessionId: 2, reason: "egress" });
  });

  it("emits live scene metrics", () => {
    incrementBroadcastLiveSceneChange({ userId: 1, roomId: "r", sessionId: 2 });
    expect(lastPayload().metric).toBe("broadcast_live_scene_change");
    incrementBroadcastLiveSceneReset({ userId: 1, roomId: "r", sessionId: 2 });
    expect(lastPayload().metric).toBe("broadcast_live_scene_reset");
    incrementBroadcastLiveSceneError({ userId: 1, roomId: "r", sessionId: 2, reason: "validation" });
    expect(lastPayload().metric).toBe("broadcast_live_scene_error");
  });

  it("emits overlay metrics", () => {
    incrementBroadcastOverlayChange({ userId: 1, roomId: "r", sessionId: 2 });
    expect(lastPayload().metric).toBe("broadcast_overlay_change");
    incrementBroadcastOverlayReset({ userId: 1, roomId: "r", sessionId: 2 });
    expect(lastPayload().metric).toBe("broadcast_overlay_reset");
    incrementBroadcastOverlayError({ userId: 1, roomId: "r", sessionId: 2, reason: "validation" });
    expect(lastPayload().metric).toBe("broadcast_overlay_error");
  });

  it("emits broadcast event idempotent attach metrics", () => {
    incrementBroadcastEventIdempotentAttach({ userId: 1, roomId: "r", sessionId: 9, reason: "attached" });
    expect(lastPayload().metric).toBe("broadcast_event_idempotent_attach");
    incrementBroadcastEventIdempotentAttachConflict({
      userId: 1,
      roomId: "r",
      sessionId: 9,
      reason: "requested_2_existing_1",
    });
    expect(lastPayload().metric).toBe("broadcast_event_idempotent_attach_conflict");
  });

  it("emits auto-directing metrics", () => {
    incrementBroadcastAutoDirectingChange({ userId: 1, roomId: "r", sessionId: 2, reason: "policy" });
    expect(lastPayload().metric).toBe("broadcast_auto_directing_change");
    incrementBroadcastAutoDirectingDecision({ userId: 1, roomId: "r", sessionId: 2, reason: "debounce" });
    expect(lastPayload().metric).toBe("broadcast_auto_directing_decision");
    incrementBroadcastAutoDirectingApply({ userId: 1, roomId: "r", sessionId: 2, reason: "auto" });
    expect(lastPayload().metric).toBe("broadcast_auto_directing_apply");
    incrementBroadcastAutoDirectingPauseManualOverride({ userId: 1, roomId: "r", sessionId: 2, reason: "layout" });
    expect(lastPayload().metric).toBe("broadcast_auto_directing_pause_manual_override");
    incrementBroadcastAutoDirectingError({ userId: 1, roomId: "r", sessionId: 2, reason: "engine" });
    expect(lastPayload().metric).toBe("broadcast_auto_directing_error");
  });

  it("covers all increment helpers with distinct metric names", () => {
    incrementBroadcastStartSuccess({ userId: 1, roomId: "r", sessionId: 9 });
    incrementBroadcastStartIdempotent({ userId: 1, roomId: "r", sessionId: 9 });
    incrementBroadcastRoomBusy({ userId: 2, roomId: "r2", sessionId: null });
    incrementBroadcastPreflightFailure({ userId: 2, roomId: "r2", sessionId: 3 });
    incrementBroadcastEgressFailure({ userId: 2, roomId: "r2", sessionId: 3 });
    incrementBroadcastStop({ userId: 2, roomId: "r2", sessionId: 3 });
    incrementBroadcastStopNoop({ userId: 2, roomId: "r2", sessionId: null });
    incrementBroadcastReconciled({ userId: null, roomId: "r2", sessionId: 3 });
    incrementBroadcastDegraded({ userId: 1, roomId: "r", sessionId: 9 });
    incrementBroadcastLiveSceneChange({ userId: 1, roomId: "r", sessionId: 9 });
    incrementBroadcastLiveSceneReset({ userId: 1, roomId: "r", sessionId: 9 });
    incrementBroadcastLiveSceneError({ userId: 1, roomId: "r", sessionId: 9, reason: "x" });
    incrementBroadcastOverlayChange({ userId: 1, roomId: "r", sessionId: 9 });
    incrementBroadcastOverlayReset({ userId: 1, roomId: "r", sessionId: 9 });
    incrementBroadcastOverlayError({ userId: 1, roomId: "r", sessionId: 9, reason: "x" });
    incrementBroadcastAutoDirectingChange({ userId: 1, roomId: "r", sessionId: 9, reason: "p" });
    incrementBroadcastAutoDirectingDecision({ userId: 1, roomId: "r", sessionId: 9, reason: "d" });
    incrementBroadcastAutoDirectingApply({ userId: 1, roomId: "r", sessionId: 9, reason: "a" });
    incrementBroadcastAutoDirectingPauseManualOverride({ userId: 1, roomId: "r", sessionId: 9, reason: "m" });
    incrementBroadcastAutoDirectingError({ userId: 1, roomId: "r", sessionId: 9, reason: "e" });

    const metrics = info.mock.calls.map((c) => (JSON.parse(c[0] as string) as { metric: string }).metric);
    expect(new Set(metrics).size).toBe(20);
  });
});
