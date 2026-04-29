/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildBroadcastTimelineEvent,
  summarizeBroadcastTimelineEvent,
  validateBroadcastTimelineEvent,
} from "./broadcast-timeline";

describe("broadcast-timeline", () => {
  it("validateBroadcastTimelineEvent accepts valid input", () => {
    const v = validateBroadcastTimelineEvent({
      eventType: "session_started",
      summary: "Started",
      detailsJson: { a: 1 },
      eventAtIso: "2026-01-01T12:00:00.000Z",
    });
    expect(v.ok).toBe(true);
  });

  it("validateBroadcastTimelineEvent rejects bad type", () => {
    const v = validateBroadcastTimelineEvent({
      eventType: "not_a_type",
      summary: "x",
      detailsJson: null,
    });
    expect(v.ok).toBe(false);
  });

  it("buildBroadcastTimelineEvent clamps summary and redacts risky keys", () => {
    const b = buildBroadcastTimelineEvent({
      broadcastSessionId: 1,
      userId: 2,
      eventType: "note",
      summary: "  hi  ",
      detailsJson: { ok: true, streamKey: "secret", nested: { url: "x" } },
    });
    expect(b.summary).toBe("hi");
    expect(b.detailsJson).not.toHaveProperty("streamKey");
  });

  it("summarizeBroadcastTimelineEvent formats one line", () => {
    const s = summarizeBroadcastTimelineEvent({
      eventType: "live_scene_changed",
      summary: "Scene x",
      eventAtIso: "2026-04-10T15:30:45.000Z",
    });
    expect(s).toContain("live_scene_changed");
    expect(s).toContain("Scene x");
  });
});
