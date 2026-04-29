/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const publishMock = jest.fn(async () => {});

jest.mock("./broadcast-realtime-adapter", () => ({
  getBroadcastRealtimeAdapter: () => ({
    name: "memory" as const,
    publish: publishMock,
    subscribe: async () => () => {},
    health: async () => ({ ok: true }),
    getSessionMeta: async () => ({ subscriberCount: 0, lastEventAtIso: null }),
  }),
}));

import {
  publishAutoDirectingApplied,
  publishAutoDirectingDecision,
  publishAutoDirectingUpdated,
  publishLiveSceneUpdated,
} from "./broadcast-event-publisher";

describe("broadcast-event-publisher", () => {
  beforeEach(() => {
    publishMock.mockClear();
  });

  it("publishLiveSceneUpdated pushes live_scene and render_refresh envelopes", async () => {
    publishLiveSceneUpdated(9, "room-z");
    await new Promise((r) => setTimeout(r, 10));
    expect(publishMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    const types = publishMock.mock.calls.map((c) => c[0].type);
    expect(types).toContain("live_scene_updated");
    expect(types).toContain("render_model_refresh_requested");
  });

  it("publishAutoDirectingUpdated publishes auto_directing_updated and refresh hint", async () => {
    publishAutoDirectingUpdated(9, "room-z", { settings: true });
    await new Promise((r) => setTimeout(r, 10));
    const types = publishMock.mock.calls.map((c) => c[0].type);
    expect(types).toContain("auto_directing_updated");
    expect(types).toContain("render_model_refresh_requested");
  });

  it("publishAutoDirectingDecision publishes decision envelope", async () => {
    publishAutoDirectingDecision(9, "room-z", { reason: "r", layout: "speaker", confidence: "medium" });
    await new Promise((r) => setTimeout(r, 10));
    const types = publishMock.mock.calls.map((c) => c[0].type);
    expect(types).toContain("auto_directing_decision");
  });

  it("publishAutoDirectingApplied publishes applied envelope", async () => {
    publishAutoDirectingApplied(9, "room-z", { layout: "gallery", reason: "applied" });
    await new Promise((r) => setTimeout(r, 10));
    const types = publishMock.mock.calls.map((c) => c[0].type);
    expect(types).toContain("auto_directing_applied");
  });
});
