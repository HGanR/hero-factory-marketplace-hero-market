/**
 * @jest-environment node
 */
import { describe, it, expect, afterEach } from "@jest/globals";

describe("broadcast-realtime-factory", () => {
  const OLD_BACKEND = process.env.MEET_BROADCAST_REALTIME_BACKEND;
  const OLD_URL = process.env.UPSTASH_REDIS_REST_URL;
  const OLD_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    process.env.MEET_BROADCAST_REALTIME_BACKEND = OLD_BACKEND;
    process.env.UPSTASH_REDIS_REST_URL = OLD_URL;
    process.env.UPSTASH_REDIS_REST_TOKEN = OLD_TOKEN;
    jest.resetModules();
  });

  it("selects memory when MEET_BROADCAST_REALTIME_BACKEND is unset", async () => {
    delete process.env.MEET_BROADCAST_REALTIME_BACKEND;
    jest.resetModules();
    const { getBroadcastRealtimeAdapter } = await import("./broadcast-realtime-adapter");
    expect(getBroadcastRealtimeAdapter().name).toBe("memory");
  });

  it("falls back to memory when distributed requested without Upstash env", async () => {
    process.env.MEET_BROADCAST_REALTIME_BACKEND = "distributed";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    jest.resetModules();
    const { getBroadcastRealtimeAdapter } = await import("./broadcast-realtime-adapter");
    expect(getBroadcastRealtimeAdapter().name).toBe("memory");
  });
});
