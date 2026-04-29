/**
 * Publishes V2 broadcast realtime hints. Failures are swallowed — never throw into control-plane handlers.
 */

import { broadcastAudit } from "./broadcast-audit";
import {
  incrementBroadcastRealtimeEventPublish,
  incrementBroadcastRealtimeEventPublishFail,
  incrementBroadcastRealtimePublishFail,
  incrementBroadcastRealtimePublishSuccess,
} from "./broadcast-metrics";
import { buildBroadcastRealtimeEvent, validateBroadcastRealtimeEvent, type BroadcastRealtimeEventType } from "./broadcast-realtime";
import { getBroadcastRealtimeAdapter } from "./broadcast-realtime-adapter";
import { buildBroadcastRealtimeEnvelopeFromClientEvent } from "./broadcast-realtime-delivery";

function safePublish(eventType: BroadcastRealtimeEventType, broadcastSessionId: number, roomId: string, payload: Record<string, string | number | boolean | null>) {
  try {
    const ev = buildBroadcastRealtimeEvent({ type: eventType, broadcastSessionId, roomId, payload });
    const v = validateBroadcastRealtimeEvent(ev);
    if (!v.ok) {
      incrementBroadcastRealtimeEventPublishFail({
        userId: null,
        roomId,
        sessionId: broadcastSessionId,
        reason: v.errors.join(",").slice(0, 120),
      });
      broadcastAudit("broadcast_realtime_publish_failed", {
        broadcastSessionId,
        roomId,
        reason: "validate",
        errorSummary: v.errors.join("|").slice(0, 200),
      });
      return;
    }
    const env = buildBroadcastRealtimeEnvelopeFromClientEvent(v.event);
    void (async () => {
      try {
        await getBroadcastRealtimeAdapter().publish(env);
        incrementBroadcastRealtimeEventPublish({
          userId: null,
          roomId,
          sessionId: broadcastSessionId,
          reason: v.event.type,
        });
        incrementBroadcastRealtimePublishSuccess({
          userId: null,
          roomId,
          sessionId: broadcastSessionId,
          reason: v.event.type,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 200) : "unknown";
        incrementBroadcastRealtimeEventPublishFail({
          userId: null,
          roomId,
          sessionId: broadcastSessionId,
          reason: msg.slice(0, 120),
        });
        incrementBroadcastRealtimePublishFail({
          userId: null,
          roomId,
          sessionId: broadcastSessionId,
          reason: msg.slice(0, 120),
        });
        broadcastAudit("broadcast_realtime_publish_failed", {
          broadcastSessionId,
          roomId,
          reason: "adapter",
          errorSummary: msg,
        });
      }
    })();
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    incrementBroadcastRealtimeEventPublishFail({
      userId: null,
      roomId,
      sessionId: broadcastSessionId,
      reason: msg.slice(0, 120),
    });
    broadcastAudit("broadcast_realtime_publish_failed", {
      broadcastSessionId,
      roomId,
      reason: "exception",
      errorSummary: msg,
    });
  }
}

export function publishBroadcastRealtimeEvent(params: {
  type: BroadcastRealtimeEventType;
  broadcastSessionId: number;
  roomId: string;
  payload?: Record<string, string | number | boolean | null>;
}): void {
  safePublish(params.type, params.broadcastSessionId, params.roomId, params.payload ?? {});
}

export function publishLiveSceneUpdated(broadcastSessionId: number, roomId: string): void {
  safePublish("live_scene_updated", broadcastSessionId, roomId, {});
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}

export function publishOverlaysUpdated(broadcastSessionId: number, roomId: string): void {
  safePublish("overlays_updated", broadcastSessionId, roomId, {});
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}

export function publishScheduleUpdated(broadcastSessionId: number, roomId: string): void {
  safePublish("schedule_updated", broadcastSessionId, roomId, {});
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}

export function publishCountdownUpdated(broadcastSessionId: number, roomId: string): void {
  safePublish("countdown_updated", broadcastSessionId, roomId, {});
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}

export function publishScheduleActionExecuted(
  broadcastSessionId: number,
  roomId: string,
  actionId: string,
  actionType: string
): void {
  safePublish("schedule_action_executed", broadcastSessionId, roomId, {
    actionId: actionId.slice(0, 64),
    actionType: actionType.slice(0, 48),
  });
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}

export function publishScheduleActionFailed(
  broadcastSessionId: number,
  roomId: string,
  actionId: string,
  actionType: string
): void {
  safePublish("schedule_action_failed", broadcastSessionId, roomId, {
    actionId: actionId.slice(0, 64),
    actionType: actionType.slice(0, 48),
  });
}

export function publishRenderRefreshRequested(broadcastSessionId: number, roomId: string): void {
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}

export function publishAutoDirectingUpdated(
  broadcastSessionId: number,
  roomId: string,
  payload: Record<string, string | number | boolean | null>
): void {
  safePublish("auto_directing_updated", broadcastSessionId, roomId, payload);
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}

export function publishAutoDirectingDecision(
  broadcastSessionId: number,
  roomId: string,
  payload: { reason: string; layout: string; confidence: string }
): void {
  safePublish("auto_directing_decision", broadcastSessionId, roomId, {
    reason: payload.reason.slice(0, 120),
    layout: payload.layout.slice(0, 48),
    confidence: payload.confidence,
  });
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}

export function publishAutoDirectingApplied(
  broadcastSessionId: number,
  roomId: string,
  payload: { layout: string; reason: string }
): void {
  safePublish("auto_directing_applied", broadcastSessionId, roomId, {
    layout: payload.layout.slice(0, 48),
    reason: payload.reason.slice(0, 120),
  });
  safePublish("render_model_refresh_requested", broadcastSessionId, roomId, {});
}
