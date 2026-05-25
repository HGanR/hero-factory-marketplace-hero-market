import type { BroadcastRealtimeEventType } from "./broadcast-realtime";

export type BroadcastRealtimeSessionMeta = {
  subscriberCount: number;
  lastEventAtIso: string | null;
};

/** Wire payload passed through memory / Redis realtime adapters. */
export type BroadcastRealtimeEnvelope = {
  id: string;
  type: BroadcastRealtimeEventType | string;
  broadcastSessionId: string | number;
  roomId: string;
  atIso: string;
  payload: Record<string, string | number | boolean | null> | Record<string, unknown>;
};

export type BroadcastRealtimeAdapter = {
  readonly name: "memory" | "distributed";
  publish(event: BroadcastRealtimeEnvelope): Promise<void>;
  subscribe(channel: string, onMessage: (event: BroadcastRealtimeEnvelope) => void): Promise<() => void>;
  health(): Promise<{ ok: boolean; detail?: string }>;
  getSessionMeta(broadcastSessionId: number): Promise<BroadcastRealtimeSessionMeta>;
};
