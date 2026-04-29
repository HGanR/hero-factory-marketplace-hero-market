/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  maskRtmpOutputUrl,
  resolveRtmpDestination,
  orientationWarnings,
  isValidRtmpIngestUrl,
} from "./rtmp";

describe("streaming/rtmp", () => {
  it("resolves twitch with default ingest", () => {
    const r = resolveRtmpDestination({
      platform: "twitch",
      serverUrl: "",
      streamKey: "live_abc123",
    });
    expect(r.finalOutputUrl).toBe("rtmp://live.twitch.tv/app/live_abc123");
    expect(r.requiresManualGoLive).toBe(false);
  });

  it("masks stream key in URL", () => {
    const m = maskRtmpOutputUrl("rtmp://live.twitch.tv/app/live_abc123", "c123");
    expect(m).toContain("****");
    expect(m).toContain("c123");
    expect(m).not.toContain("live_abc123");
  });

  it("requires server URL for custom", () => {
    const r = resolveRtmpDestination({
      platform: "custom",
      serverUrl: "",
      streamKey: "k",
    });
    expect(r.finalOutputUrl).toBe("");
    expect(r.warnings.some((w) => /server_url/i.test(w))).toBe(true);
  });

  it("includes capability-driven warnings for instagram", () => {
    const r = resolveRtmpDestination({
      platform: "instagram",
      serverUrl: "",
      streamKey: "key",
    });
    expect(r.finalOutputUrl).toContain("instagram");
    expect(r.warnings.some((w) => /manual go-live/i.test(w))).toBe(true);
    expect(r.warnings.some((w) => /Portrait orientation/i.test(w))).toBe(true);
  });

  it("includes capability-driven warnings for tiktok", () => {
    const r = resolveRtmpDestination({
      platform: "tiktok",
      serverUrl: "",
      streamKey: "key",
    });
    expect(r.warnings.some((w) => /TikTok ingest may not be stable/i.test(w))).toBe(true);
    expect(r.requiresManualGoLive).toBe(true);
  });

  it("adds portrait recommendation when layout is landscape-like and orientation auto", () => {
    const r = resolveRtmpDestination({
      platform: "instagram",
      serverUrl: "",
      streamKey: "key",
      meetingLayout: "grid",
      orientationPreference: "auto",
    });
    expect(
      r.warnings.some((w) => /Portrait orientation recommended for this provider/i.test(w))
    ).toBe(true);
  });

  it("orientationWarnings flags portrait vs landscape layout", () => {
    const w = orientationWarnings("portrait", "grid");
    expect(w.length).toBeGreaterThan(0);
  });

  it("isValidRtmpIngestUrl accepts typical twitch url", () => {
    expect(isValidRtmpIngestUrl("rtmp://live.twitch.tv/app/live_key")).toBe(true);
    expect(isValidRtmpIngestUrl("rtmps://x.com/a/b")).toBe(true);
    expect(isValidRtmpIngestUrl("https://x.com/a")).toBe(false);
    expect(isValidRtmpIngestUrl("rtmp://onlyhost")).toBe(false);
  });
});
