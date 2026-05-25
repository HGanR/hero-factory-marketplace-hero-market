/**
 * In-process pub/sub — same semantics as the legacy hub, behind BroadcastRealtimeAdapter.
 */

import type {
  BroadcastRealtimeAdapter,
  BroadcastRealtimeEnvelope,
  BroadcastRealtimeSessionMeta,
} from "./broadcast-realtime-adapter-interface";
import { buildBroadcastRealtimeChannelForSession } from "./broadcast-realtime-channels";

const HUB_KEY = "__heroMeetBroadcastRealtimeAdapterMemory_v1" as const;

type MemState = {
  channels: Map<string, Map<string, (env: BroadcastRealtimeEnvelope) => void>>;
  lastEventAt: Map<string, string>;
};

function state(): MemState {
  const g = globalThis as unknown as Record<string, MemState | undefined>;
  if (!g[HUB_KEY]) {
    g[HUB_KEY] = { channels: new Map(), lastEventAt: new Map() };
  }
  return g[HUB_KEY]!;
}

export class BroadcastRealtimeMemoryAdapter implements BroadcastRealtimeAdapter {
  readonly name = "memory" as const;

  async publish(event: BroadcastRealtimeEnvelope): Promise<void> {
    const sid = Number(event.broadcastSessionId);
    if (!Number.isFinite(sid) || sid <= 0) return;
    const channel = buildBroadcastRealtimeChannelForSession(sid);
    const st = state();
    st.lastEventAt.set(channel, event.atIso);
    const ch = st.channels.get(channel);
    if (!ch || ch.size === 0) return;
    const dead: string[] = [];
    for (const [subId, fn] of ch) {
      try {
        fn(event);
      } catch {
        dead.push(subId);
      }
    }
    for (const id of dead) ch.delete(id);
    if (ch.size === 0) st.channels.delete(channel);
  }

  async subscribe(channel: string, onMessage: (event: BroadcastRealtimeEnvelope) => void): Promise<() => void> {
    const st = state();
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    let ch = st.channels.get(channel);
    if (!ch) {
      ch = new Map();
      st.channels.set(channel, ch);
    }
    ch.set(id, onMessage);
    return () => {
      const c = st.channels.get(channel);
      if (!c) return;
      c.delete(id);
      if (c.size === 0) st.channels.delete(channel);
    };
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true, detail: "memory" };
  }

  async getSessionMeta(broadcastSessionId: number): Promise<BroadcastRealtimeSessionMeta> {
    const channel = buildBroadcastRealtimeChannelForSession(broadcastSessionId);
    const st = state();
    const ch = st.channels.get(channel);
    return {
      subscriberCount: ch?.size ?? 0,
      lastEventAtIso: st.lastEventAt.get(channel) ?? null,
    };
  }
}
