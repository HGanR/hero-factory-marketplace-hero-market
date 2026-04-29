/**
 * Durable per-session operational timeline (distinct from log metrics + security audit trail).
 * Retention: application does not prune in this phase — ops may add TTL jobs later.
 */

export const BROADCAST_TIMELINE_EVENT_TYPES = [
  "session_started",
  "session_stopped",
  "destination_attached",
  "destination_failed",
  "degraded_entered",
  "degraded_cleared",
  "compositor_v2_enabled",
  "compositor_v2_fallback",
  "live_scene_changed",
  "live_scene_reset",
  "overlay_changed",
  "overlay_reset",
  "countdown_started",
  "countdown_stopped",
  "schedule_action_executed",
  "auto_directing_decision",
  "auto_directing_applied",
  "auto_directing_manual_override",
  "event_attached",
  "event_conflict",
  "note",
] as const;

export type BroadcastTimelineEventType = (typeof BROADCAST_TIMELINE_EVENT_TYPES)[number];

export const BROADCAST_TIMELINE_SUMMARY_MAX = 512;
export const BROADCAST_TIMELINE_DETAILS_MAX_JSON_CHARS = 6000;
export const BROADCAST_TIMELINE_DETAILS_MAX_KEYS = 48;

export type BroadcastTimelineEvent = {
  id: number;
  broadcastSessionId: number;
  userId: number;
  eventType: BroadcastTimelineEventType;
  eventAtIso: string;
  summary: string;
  detailsJson: Record<string, unknown> | null;
};

export type BroadcastTimelineAppendInput = {
  broadcastSessionId: number;
  userId: number;
  eventType: BroadcastTimelineEventType;
  summary: string;
  detailsJson?: Record<string, unknown> | null;
  eventAtIso?: string;
};

function clampSummary(s: string): string {
  const t = s.trim();
  if (!t) return "(no summary)";
  return t.slice(0, BROADCAST_TIMELINE_SUMMARY_MAX);
}

/** Strip common secret patterns from details (defense in depth). */
function redactDetails(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const secretKey = /url|token|key|secret|password|authorization|streamKey|rtmp/i;
  for (const [k, v] of Object.entries(obj)) {
    if (secretKey.test(k)) continue;
    if (typeof v === "string" && (v.startsWith("rtmp://") || v.startsWith("rtmps://"))) continue;
    out[k] = v;
  }
  return out;
}

export function buildBroadcastTimelineEvent(input: BroadcastTimelineAppendInput): {
  broadcastSessionId: number;
  userId: number;
  eventType: BroadcastTimelineEventType;
  summary: string;
  detailsJson: Record<string, unknown> | null;
  eventAtIso: string;
} {
  return {
    broadcastSessionId: input.broadcastSessionId,
    userId: input.userId,
    eventType: input.eventType,
    summary: clampSummary(input.summary),
    detailsJson: input.detailsJson && typeof input.detailsJson === "object" ? redactDetails(input.detailsJson) : null,
    eventAtIso: input.eventAtIso?.trim() || new Date().toISOString(),
  };
}

export function summarizeBroadcastTimelineEvent(e: Pick<BroadcastTimelineEvent, "eventType" | "summary" | "eventAtIso">): string {
  return `[${e.eventAtIso.slice(11, 19)}] ${e.eventType}: ${e.summary}`;
}

export function validateBroadcastTimelineEvent(input: {
  eventType: unknown;
  summary: unknown;
  detailsJson: unknown;
  eventAtIso?: unknown;
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (typeof input.eventType !== "string" || !BROADCAST_TIMELINE_EVENT_TYPES.includes(input.eventType as BroadcastTimelineEventType)) {
    errors.push("invalid eventType");
  }
  if (typeof input.summary !== "string" || !input.summary.trim()) {
    errors.push("summary required");
  } else if (input.summary.length > BROADCAST_TIMELINE_SUMMARY_MAX) {
    errors.push("summary too long");
  }
  if (input.detailsJson != null && typeof input.detailsJson !== "object") {
    errors.push("detailsJson must be object or null");
  }
  if (input.detailsJson != null && typeof input.detailsJson === "object" && !Array.isArray(input.detailsJson)) {
    const keys = Object.keys(input.detailsJson as object);
    if (keys.length > BROADCAST_TIMELINE_DETAILS_MAX_KEYS) errors.push("detailsJson too many keys");
    try {
      const s = JSON.stringify(input.detailsJson);
      if (s.length > BROADCAST_TIMELINE_DETAILS_MAX_JSON_CHARS) errors.push("detailsJson too large");
    } catch {
      errors.push("detailsJson not serializable");
    }
  }
  if (input.eventAtIso != null && input.eventAtIso !== undefined) {
    if (typeof input.eventAtIso !== "string" || Number.isNaN(Date.parse(input.eventAtIso))) {
      errors.push("invalid eventAtIso");
    }
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}
