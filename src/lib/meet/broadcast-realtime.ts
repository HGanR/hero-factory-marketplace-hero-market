/**
 * V2 broadcast realtime: invalidation hints over SSE. Server truth stays on DB + poll/refetch; events are not authoritative.
 */

export const BROADCAST_REALTIME_EVENT_TYPES = [
  "live_scene_updated",
  "overlays_updated",
  "schedule_updated",
  "countdown_updated",
  "schedule_action_executed",
  "schedule_action_failed",
  "render_model_refresh_requested",
  "auto_directing_updated",
  "auto_directing_decision",
  "auto_directing_applied",
] as const;

export type BroadcastRealtimeEventType = (typeof BROADCAST_REALTIME_EVENT_TYPES)[number];

export type BroadcastRealtimeEvent = {
  type: BroadcastRealtimeEventType;
  broadcastSessionId: number;
  roomId: string;
  atIso: string;
  /** Stable id for best-effort client dedupe across reconnects; not authoritative. */
  eventId: string;
  /** Minimal non-sensitive hints (e.g. action id); never stream keys or URLs. */
  payload: Record<string, string | number | boolean | null>;
};

function newRealtimeEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function buildBroadcastRealtimeEvent(input: {
  type: BroadcastRealtimeEventType;
  broadcastSessionId: number;
  roomId: string;
  atIso?: string;
  eventId?: string;
  payload?: Record<string, string | number | boolean | null>;
}): BroadcastRealtimeEvent {
  return {
    type: input.type,
    broadcastSessionId: input.broadcastSessionId,
    roomId: input.roomId,
    atIso: input.atIso ?? new Date().toISOString(),
    eventId: input.eventId ?? newRealtimeEventId(),
    payload: input.payload ?? {},
  };
}

export function validateBroadcastRealtimeEvent(
  input: unknown
): { ok: true; event: BroadcastRealtimeEvent } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (input == null || typeof input !== "object") {
    return { ok: false, errors: ["event must be an object"] };
  }
  const o = input as Record<string, unknown>;
  const t = o.type;
  if (typeof t !== "string" || !(BROADCAST_REALTIME_EVENT_TYPES as readonly string[]).includes(t)) {
    errors.push("invalid type");
  }
  const sid = o.broadcastSessionId;
  if (typeof sid !== "number" || !Number.isFinite(sid) || sid <= 0) {
    errors.push("invalid broadcastSessionId");
  }
  const rid = o.roomId;
  if (typeof rid !== "string" || !rid.trim()) {
    errors.push("invalid roomId");
  }
  const at = o.atIso;
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) {
    errors.push("invalid atIso");
  }
  const eid = o.eventId;
  if (typeof eid !== "string" || !eid.trim() || eid.length > 120) {
    errors.push("invalid eventId");
  }
  const p = o.payload;
  if (p != null && typeof p !== "object") {
    errors.push("invalid payload");
  }
  if (errors.length) return { ok: false, errors };

  const payload: Record<string, string | number | boolean | null> = {};
  if (p && typeof p === "object") {
    for (const [k, v] of Object.entries(p as Record<string, unknown>)) {
      if (k.length > 64) continue;
      if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        const sv = typeof v === "string" ? v.slice(0, 200) : v;
        payload[k] = sv;
      }
    }
  }

  return {
    ok: true,
    event: {
      type: t as BroadcastRealtimeEventType,
      broadcastSessionId: sid as number,
      roomId: (rid as string).trim(),
      atIso: at as string,
      eventId: (eid as string).trim(),
      payload,
    },
  };
}
