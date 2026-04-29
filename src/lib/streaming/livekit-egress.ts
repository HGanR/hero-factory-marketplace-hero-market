import { EgressClient, StreamOutput, StreamProtocol } from "livekit-server-sdk";

export function livekitHttpHostFromEnv(): string | null {
  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) return null;
  return url.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
}

export function createEgressClient(): EgressClient {
  const host = livekitHttpHostFromEnv();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!host || !apiKey || !apiSecret) {
    throw new Error("LiveKit env not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)");
  }
  return new EgressClient(host, apiKey, apiSecret);
}

/** Optional scene intent for future compositor / provider metadata (V1 unused by LiveKit SDK). */
export type RoomCompositeSceneIntent = {
  sceneLayoutMode: string;
  portraitSafe: boolean;
  screenSharePriority: boolean;
  brandingEnabled: boolean;
};

/**
 * Room composite → multiple RTMP URLs (single egress fan-out).
 * Protocol DEFAULT lets LiveKit infer rtmp vs rtmps from each URL.
 */
export async function startRoomCompositeRtmpFanOut(params: {
  roomName: string;
  rtmpUrls: string[];
  layout: string;
  /** Carried for forward compatibility; room composite API still uses `layout` only in V1. */
  sceneIntent?: RoomCompositeSceneIntent;
  /** When set, LiveKit egress loads this URL as custom template base (merged with layout/url/token query params). */
  customBaseUrl?: string;
}): Promise<{ egressId: string; status: number }> {
  if (!params.rtmpUrls.length) {
    throw new Error("At least one RTMP URL is required");
  }
  void params.sceneIntent;
  const client = createEgressClient();
  const stream = new StreamOutput({
    protocol: StreamProtocol.DEFAULT_PROTOCOL,
    urls: params.rtmpUrls,
  });
  const cbu = params.customBaseUrl?.trim();
  const opts = cbu ? { layout: params.layout, customBaseUrl: cbu } : { layout: params.layout };
  const info = await client.startRoomCompositeEgress(params.roomName, { stream }, opts);
  return { egressId: info.egressId, status: info.status };
}

export async function stopEgressById(egressId: string): Promise<void> {
  const client = createEgressClient();
  await client.stopEgress(egressId);
}

/** All egress rows for a room (any status) — used for DB/LiveKit reconciliation. */
export async function fetchRoomEgressStatusById(roomName: string): Promise<Map<string, number>> {
  if (!livekitHttpHostFromEnv()) {
    throw new Error("LiveKit not configured");
  }
  const client = createEgressClient();
  const list = await client.listEgress({ roomName });
  const m = new Map<string, number>();
  for (const e of list) {
    if (e.egressId) m.set(e.egressId, e.status);
  }
  return m;
}
