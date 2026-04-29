/**
 * SSE wire helpers for V2 broadcast realtime. Fan-out lives in {@link ./broadcast-realtime-adapter.ts}.
 */

/** SSE wire format: one named event per client push. */
export function broadcastRealtimeSseChunk(eventType: string, jsonPayload: string): Uint8Array {
  const line = `event: ${eventType}\ndata: ${jsonPayload}\n\n`;
  return new TextEncoder().encode(line);
}
