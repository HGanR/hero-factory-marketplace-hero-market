/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { BroadcastRealtimeDistributedAdapter } from "./broadcast-realtime-adapter-distributed";
import { buildBroadcastRealtimeEnvelopeFromClientEvent } from "./broadcast-realtime-delivery";
import { buildBroadcastRealtimeEvent, validateBroadcastRealtimeEvent } from "./broadcast-realtime";

jest.mock("./broadcast-realtime-redis", () => ({
  upstashRedisPipeline: jest.fn(),
}));

import { upstashRedisPipeline } from "./broadcast-realtime-redis";

describe("BroadcastRealtimeDistributedAdapter", () => {
  beforeEach(() => {
    (upstashRedisPipeline as jest.Mock).mockReset();
  });

  it("publish issues XADD + EXPIRE via pipeline", async () => {
    (upstashRedisPipeline as jest.Mock).mockResolvedValueOnce([{ result: "1-0" }, { result: 1 }]);
    const adapter = new BroadcastRealtimeDistributedAdapter();
    const raw = buildBroadcastRealtimeEvent({
      type: "overlays_updated",
      broadcastSessionId: 4,
      roomId: "r",
      payload: {},
    });
    const v = validateBroadcastRealtimeEvent(raw);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    await adapter.publish(buildBroadcastRealtimeEnvelopeFromClientEvent(v.event));
    expect(upstashRedisPipeline).toHaveBeenCalledTimes(1);
    const cmd = (upstashRedisPipeline as jest.Mock).mock.calls[0][0] as unknown[][];
    expect(cmd[0][0]).toBe("XADD");
    expect(cmd[0][1]).toBe("meet_br_rt_s_4");
    expect(cmd[1][0]).toBe("EXPIRE");
  });

  it("subscribe throws when XRANGE errors", async () => {
    (upstashRedisPipeline as jest.Mock).mockResolvedValueOnce([{ error: "fail" }]);
    const adapter = new BroadcastRealtimeDistributedAdapter();
    await expect(adapter.subscribe("meet_br_rt_s_1", () => {})).rejects.toThrow();
  });
});
