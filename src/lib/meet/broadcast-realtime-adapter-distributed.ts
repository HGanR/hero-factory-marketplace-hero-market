/**
 * Upstash Redis Streams backbone — cross-instance fan-out with short replay on subscribe.
 */

import type {
  BroadcastRealtimeAdapter,
  BroadcastRealtimeEnvelope,
  BroadcastRealtimeSessionMeta,
} from "./broadcast-realtime-adapter-interface";
import { upstashRedisPipeline } from "./broadcast-realtime-redis";
import { buildBroadcastRealtimeChannelForSession } from "./broadcast-realtime-channels";
import {
  buildBroadcastRealtimeEnvelopeFromClientEvent,
  clientEventJsonFromEnvelope,
} from "./broadcast-realtime-delivery";
import { validateBroadcastRealtimeEvent } from "./broadcast-realtime";
const POLL_MS = 750;
const STREAM_MAXLEN = "~";
const STREAM_MAXLEN_N = 128;
const STREAM_TTL_SEC = 604800;

function extractField(fields: unknown, key: string): string | null {
  if (!Array.isArray(fields)) return null;
  for (let i = 0; i < fields.length - 1; i += 2) {
    if (fields[i] === key && typeof fields[i + 1] === "string") return fields[i + 1] as string;
  }
  return null;
}

/** XREAD returns `[ [ streamKey, [ [id, fields], ... ] ] ]`. */
function parseXreadEntries(result: unknown): Array<{ id: string; data: string }> {
  const out: Array<{ id: string; data: string }> = [];
  if (!Array.isArray(result) || result.length === 0) return out;
  for (const streamBlock of result) {
    if (!Array.isArray(streamBlock) || streamBlock.length < 2) continue;
    const entries = streamBlock[1];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const id = String(entry[0]);
      const data = extractField(entry[1], "data");
      if (data) out.push({ id, data });
    }
  }
  return out;
}

/** XRANGE / XREVRANGE return `[ [id, fields], ... ]`. */
function parseFlatStreamEntries(result: unknown): Array<{ id: string; data: string }> {
  const out: Array<{ id: string; data: string }> = [];
  if (!Array.isArray(result)) return out;
  for (const entry of result) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const id = String(entry[0]);
    const data = extractField(entry[1], "data");
    if (data) out.push({ id, data });
  }
  return out;
}

function envelopeFromStoredJson(json: string): BroadcastRealtimeEnvelope | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    const v = validateBroadcastRealtimeEvent(parsed);
    if (!v.ok) return null;
    return buildBroadcastRealtimeEnvelopeFromClientEvent(v.event);
  } catch {
    return null;
  }
}

export class BroadcastRealtimeDistributedAdapter implements BroadcastRealtimeAdapter {
  readonly name = "distributed" as const;

  async publish(event: BroadcastRealtimeEnvelope): Promise<void> {
    const sid = Number(event.broadcastSessionId);
    if (!Number.isFinite(sid) || sid <= 0) return;
    const json = clientEventJsonFromEnvelope(event);
    if (!json) return;
    const key = buildBroadcastRealtimeChannelForSession(sid);
    const res = await upstashRedisPipeline([
      ["XADD", key, "MAXLEN", STREAM_MAXLEN, String(STREAM_MAXLEN_N), "*", "data", json],
      ["EXPIRE", key, String(STREAM_TTL_SEC)],
    ]);
    const err = res[0]?.error;
    if (err) {
      throw new Error(String(err));
    }
  }

  async subscribe(channel: string, onMessage: (event: BroadcastRealtimeEnvelope) => void): Promise<() => void> {
    let lastId = "0-0";
    const replay = await upstashRedisPipeline([["XRANGE", channel, "-", "+", "COUNT", "8"]]);
    if (replay[0]?.error) {
      throw new Error(String(replay[0].error));
    }
    const replayed = parseFlatStreamEntries(replay[0]?.result);
    for (const e of replayed) {
      lastId = e.id;
      const env = envelopeFromStoredJson(e.data);
      if (env) onMessage(env);
    }

    const timer = setInterval(() => {
      void (async () => {
        try {
          const res = await upstashRedisPipeline([["XREAD", "COUNT", "64", "STREAMS", channel, lastId]]);
          if (res[0]?.error) return;
          const blocks = parseXreadEntries(res[0]?.result);
          for (const b of blocks) {
            lastId = b.id;
            const env = envelopeFromStoredJson(b.data);
            if (env) onMessage(env);
          }
        } catch {
          /* ignore tick errors */
        }
      })();
    }, POLL_MS);

    return () => {
      clearInterval(timer);
    };
  }

  async health(): Promise<{ ok: boolean; detail?: string }> {
    const res = await upstashRedisPipeline([["PING"]]);
    const err = res[0]?.error;
    if (err) return { ok: false, detail: String(err).slice(0, 200) };
    const r = res[0]?.result;
    if (r === "PONG" || r === true) return { ok: true, detail: "upstash" };
    return { ok: false, detail: "unexpected_ping" };
  }

  async getSessionMeta(broadcastSessionId: number): Promise<BroadcastRealtimeSessionMeta> {
    const key = buildBroadcastRealtimeChannelForSession(broadcastSessionId);
    const res = await upstashRedisPipeline([["XREVRANGE", key, "+", "-", "COUNT", "1"]]);
    if (res[0]?.error || res[0]?.result == null) {
      return { subscriberCount: 0, lastEventAtIso: null };
    }
    const entries = parseFlatStreamEntries(res[0]?.result);
    const last = entries[0];
    if (!last) return { subscriberCount: 0, lastEventAtIso: null };
    const env = envelopeFromStoredJson(last.data);
    return {
      subscriberCount: 0,
      lastEventAtIso: env?.atIso ?? null,
    };
  }
}
