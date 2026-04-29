import { broadcastAudit } from "./broadcast-audit";
import { getBroadcastRealtimeAdapter } from "./broadcast-realtime-adapter";
import { buildBroadcastRealtimeChannelForSession } from "./broadcast-realtime-channels";
import { clientEventFromEnvelope, clientEventJsonFromEnvelope } from "./broadcast-realtime-delivery";
import {
  incrementBroadcastRealtimeSubscribeFail,
  incrementBroadcastRealtimeSubscribeSuccess,
} from "./broadcast-metrics";
import { broadcastRealtimeSseChunk } from "./broadcast-realtime-hub";

export async function subscribeMeetBroadcastRealtimeSse(params: {
  req: NextRequest;
  broadcastSessionId: number;
  roomId: string;
  userId: number | null;
  channelLabel: "operator" | "template";
  renderSessionId?: number;
  safeEnqueue: (chunk: Uint8Array) => void;
}): Promise<() => void> {
  const { broadcastSessionId, roomId, userId, channelLabel, renderSessionId, safeEnqueue } = params;
  const adapter = getBroadcastRealtimeAdapter();
  const channel = buildBroadcastRealtimeChannelForSession(broadcastSessionId);
  try {
    const unsub = await adapter.subscribe(channel, (env) => {
      const json = clientEventJsonFromEnvelope(env);
      const ev = clientEventFromEnvelope(env);
      if (!ev || !json) return;
      safeEnqueue(broadcastRealtimeSseChunk(ev.type, json));
    });
    incrementBroadcastRealtimeSubscribeSuccess({
      userId,
      roomId,
      sessionId: broadcastSessionId,
      reason: channelLabel,
    });
    return unsub;
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "subscribe_error";
    incrementBroadcastRealtimeSubscribeFail({
      userId,
      roomId,
      sessionId: broadcastSessionId,
      reason: msg.slice(0, 120),
    });
    broadcastAudit("broadcast_realtime_subscribe_failed", {
      broadcastSessionId,
      roomId,
      channel: channelLabel,
      renderSessionId: renderSessionId ?? null,
      errorSummary: msg,
      backend: adapter.name,
    });
    return () => {};
  }
}
