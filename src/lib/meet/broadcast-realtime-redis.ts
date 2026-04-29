/**
 * Minimal Upstash REST client for meet broadcast realtime (streams).
 * Reuses UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isUpstashRedisConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

export async function upstashRedisPipeline(commands: (string | number)[][]): Promise<
  Array<{ result?: unknown; error?: string }>
> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    return commands.map(() => ({ error: "redis_not_configured" }));
  }
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });
    if (!res.ok) {
      return commands.map(() => ({ error: `http_${res.status}` }));
    }
    const data = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    return Array.isArray(data) ? data : commands.map(() => ({ error: "bad_pipeline_response" }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "pipeline_error";
    return commands.map(() => ({ error: msg.slice(0, 120) }));
  }
}

export async function upstashRedisPing(): Promise<boolean> {
  const r = await upstashRedisPipeline([["PING"]]);
  return r[0]?.result === "PONG" || r[0]?.result === true;
}
