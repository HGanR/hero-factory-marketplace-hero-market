/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { BroadcastRealtimeMemoryAdapter } from "./broadcast-realtime-adapter-memory";
import { buildBroadcastRealtimeChannelForSession } from "./broadcast-realtime-channels";
import { buildBroadcastRealtimeEnvelopeFromClientEvent, clientEventFromEnvelope, clientEventJsonFromEnvelope } from "./broadcast-realtime-delivery";
import { buildBroadcastRealtimeEvent, validateBroadcastRealtimeEvent } from "./broadcast-realtime";
import { broadcastRealtimeSseChunk } from "./broadcast-realtime-hub";

describe("broadcast realtime memory adapter (legacy hub semantics)", () => {
  beforeEach(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    delete g.__heroMeetBroadcastRealtimeAdapterMemory_v1;
  });

  it("delivers publish to subscriber as envelope", async () => {
    const adapter = new BroadcastRealtimeMemoryAdapter();
    const channel = buildBroadcastRealtimeChannelForSession(7);
    const chunks: Uint8Array[] = [];
    await adapter.subscribe(channel, (env) => {
      const json = clientEventJsonFromEnvelope(env);
      const ev = clientEventFromEnvelope(env);
      if (!ev || !json) return;
      chunks.push(broadcastRealtimeSseChunk(ev.type, json));
    });
    const raw = buildBroadcastRealtimeEvent({
      type: "live_scene_updated",
      broadcastSessionId: 7,
      roomId: "r1",
      payload: {},
    });
    const v = validateBroadcastRealtimeEvent(raw);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await adapter.publish(buildBroadcastRealtimeEnvelopeFromClientEvent(v.event));
    expect(chunks.length).toBe(1);
  });

  it("records lastEventAt on publish", async () => {
    const adapter = new BroadcastRealtimeMemoryAdapter();
    const channel = buildBroadcastRealtimeChannelForSession(3);
    await adapter.subscribe(channel, () => {});
    const raw = buildBroadcastRealtimeEvent({
      type: "schedule_updated",
      broadcastSessionId: 3,
      roomId: "r1",
      payload: {},
    });
    const v = validateBroadcastRealtimeEvent(raw);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await adapter.publish(buildBroadcastRealtimeEnvelopeFromClientEvent(v.event));
    const m = await adapter.getSessionMeta(3);
    expect(m.subscriberCount).toBe(1);
    expect(m.lastEventAtIso).toBeTruthy();
  });
});
