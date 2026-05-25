import { validateBroadcastRealtimeEvent, type BroadcastRealtimeEvent } from "./broadcast-realtime";
import type { BroadcastRealtimeEnvelope } from "./broadcast-realtime-adapter-interface";

export function buildBroadcastRealtimeEnvelopeFromClientEvent(ev: BroadcastRealtimeEvent): BroadcastRealtimeEnvelope {
  return {
    id: ev.eventId,
    type: ev.type,
    broadcastSessionId: ev.broadcastSessionId,
    roomId: ev.roomId,
    atIso: ev.atIso,
    payload: ev.payload,
  };
}

export function clientEventFromEnvelope(env: BroadcastRealtimeEnvelope): BroadcastRealtimeEvent | null {
  const sid =
    typeof env.broadcastSessionId === "number"
      ? env.broadcastSessionId
      : Number(String(env.broadcastSessionId).trim());
  const payload =
    env.payload && typeof env.payload === "object" && !Array.isArray(env.payload)
      ? (env.payload as Record<string, unknown>)
      : {};
  const normalizedPayload: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k.length > 64) continue;
    if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      normalizedPayload[k] = typeof v === "string" ? v.slice(0, 200) : v;
    }
  }
  const raw = {
    type: env.type,
    broadcastSessionId: sid,
    roomId: env.roomId,
    atIso: env.atIso,
    eventId: env.id,
    payload: normalizedPayload,
  };
  const v = validateBroadcastRealtimeEvent(raw);
  return v.ok ? v.event : null;
}

export function clientEventJsonFromEnvelope(env: BroadcastRealtimeEnvelope): string | null {
  const ev = clientEventFromEnvelope(env);
  if (!ev) return null;
  return JSON.stringify(ev);
}

/** Best-effort parse for operator / SSE tooling (not a security boundary). */
export function normalizeRealtimeEnvelope(input: unknown): BroadcastRealtimeEnvelope | null {
  if (input == null || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const sidRaw = o.broadcastSessionId;
  const sid =
    typeof sidRaw === "number"
      ? sidRaw
      : typeof sidRaw === "string"
        ? Number(sidRaw.trim())
        : Number.NaN;
  const eventId =
    typeof o.eventId === "string" && o.eventId.trim()
      ? o.eventId.trim()
      : typeof o.id === "string" && o.id.trim()
        ? o.id.trim()
        : null;
  if (eventId == null) return null;
  const v = validateBroadcastRealtimeEvent({
    type: o.type,
    broadcastSessionId: sid,
    roomId: o.roomId,
    atIso: o.atIso,
    eventId,
    payload: o.payload,
  });
  if (!v.ok) return null;
  return buildBroadcastRealtimeEnvelopeFromClientEvent(v.event);
}

export function shouldIgnoreDuplicateRealtimeEvent(seen: Set<string>, id: string): boolean {
  return seen.has(id);
}

export function maybeTrackLastSeenRealtimeEvent(seen: Set<string>, id: string): void {
  seen.add(id);
}
