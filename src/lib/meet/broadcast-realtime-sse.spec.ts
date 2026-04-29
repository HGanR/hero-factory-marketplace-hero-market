/**
 * @jest-environment node
 */
import { describe, it, expect, jest } from "@jest/globals";

jest.mock("./broadcast-realtime-adapter", () => ({
  getBroadcastRealtimeAdapter: () => ({
    name: "memory" as const,
    publish: async () => {},
    subscribe: jest.fn().mockRejectedValue(new Error("redis_down")),
    health: async () => ({ ok: true }),
    getSessionMeta: async () => ({ subscriberCount: 0, lastEventAtIso: null }),
  }),
}));

import { subscribeMeetBroadcastRealtimeSse } from "./broadcast-realtime-sse";

describe("subscribeMeetBroadcastRealtimeSse", () => {
  it("returns noop unsub when adapter.subscribe rejects", async () => {
    const u = await subscribeMeetBroadcastRealtimeSse({
      broadcastSessionId: 1,
      roomId: "r",
      userId: 1,
      channelLabel: "operator",
      safeEnqueue: () => {},
    });
    await expect(Promise.resolve(u())).resolves.toBeUndefined();
  });
});
