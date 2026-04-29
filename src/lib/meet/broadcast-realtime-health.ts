import { getBroadcastRealtimeAdapter } from "./broadcast-realtime-adapter";

export function getBroadcastRealtimeBackendName(): "memory" | "distributed" {
  return getBroadcastRealtimeAdapter().name;
}

export function getBroadcastRealtimeBackendRequested(): "memory" | "distributed" {
  const raw = process.env.MEET_BROADCAST_REALTIME_BACKEND?.trim().toLowerCase();
  return raw === "distributed" ? "distributed" : "memory";
}

export async function getBroadcastRealtimeBackendStatus(): Promise<{
  requested: "memory" | "distributed";
  effective: "memory" | "distributed";
  healthy: boolean;
  detail?: string;
  fallbackActive: boolean;
}> {
  const requested = getBroadcastRealtimeBackendRequested();
  const adapter = getBroadcastRealtimeAdapter();
  const effective = adapter.name;
  const h = await adapter.health();
  return {
    requested,
    effective,
    healthy: h.ok,
    detail: h.detail,
    fallbackActive: requested === "distributed" && effective === "memory",
  };
}
