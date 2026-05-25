import { BroadcastRealtimeDistributedAdapter } from "./broadcast-realtime-adapter-distributed";
import { BroadcastRealtimeMemoryAdapter } from "./broadcast-realtime-adapter-memory";
import type { BroadcastRealtimeAdapter } from "./broadcast-realtime-adapter-interface";

export type {
  BroadcastRealtimeAdapter,
  BroadcastRealtimeEnvelope,
  BroadcastRealtimeSessionMeta,
} from "./broadcast-realtime-adapter-interface";

let cached: BroadcastRealtimeAdapter | null = null;

function resolveAdapter(): BroadcastRealtimeAdapter {
  const requested = process.env.MEET_BROADCAST_REALTIME_BACKEND?.trim().toLowerCase();
  const hasUpstash =
    Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()) && Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim());
  if (requested === "distributed" && hasUpstash) {
    return new BroadcastRealtimeDistributedAdapter();
  }
  return new BroadcastRealtimeMemoryAdapter();
}

export function getBroadcastRealtimeAdapter(): BroadcastRealtimeAdapter {
  if (!cached) cached = resolveAdapter();
  return cached;
}
