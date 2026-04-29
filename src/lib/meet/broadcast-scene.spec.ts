/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  getDefaultSceneConfig,
  getSceneConfigForOrientation,
  validateSceneConfig,
  mapBroadcastSceneToLiveKitLayout,
  parseStoredSceneSnapshot,
  legacyMeetingLayoutToSceneLayout,
} from "./broadcast-scene";

describe("broadcast-scene", () => {
  it("getDefaultSceneConfig returns gallery baseline", () => {
    const c = getDefaultSceneConfig();
    expect(c.layoutMode).toBe("gallery");
    expect(c.portraitSafe).toBe(false);
    expect(c.showParticipantNames).toBe(true);
  });

  it("validateSceneConfig rejects bad layout", () => {
    const r = validateSceneConfig({ layoutMode: "nope" });
    expect(r.ok).toBe(false);
  });

  it("validateSceneConfig merges partial branding", () => {
    const r = validateSceneConfig({ branding: { brandName: "Troo" } }, { partial: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.branding.brandName).toBe("Troo");
  });

  it("validateSceneConfig rejects non-https logoUrl", () => {
    const r = validateSceneConfig({ branding: { logoUrl: "http://x.com/a.png" } }, { partial: true });
    expect(r.ok).toBe(false);
  });

  it("mapBroadcastSceneToLiveKitLayout maps portrait_speaker to single-speaker", () => {
    const m = mapBroadcastSceneToLiveKitLayout("portrait_speaker");
    expect(m.liveKitLayout).toBe("single-speaker");
  });

  it("mapBroadcastSceneToLiveKitLayout warns for screenshare_focus", () => {
    const m = mapBroadcastSceneToLiveKitLayout("screenshare_focus");
    expect(m.liveKitLayout).toBe("speaker");
    expect(m.egressMappingWarnings.length).toBeGreaterThan(0);
  });

  it("parseStoredSceneSnapshot falls back to liveKit layout", () => {
    const s = parseStoredSceneSnapshot(null, "single-speaker");
    expect(s.layoutMode).toBe("portrait_speaker");
  });

  it("legacyMeetingLayoutToSceneLayout maps grid to gallery", () => {
    expect(legacyMeetingLayoutToSceneLayout("grid")).toBe("gallery");
  });

  it("getSceneConfigForOrientation enables portrait safe for portrait", () => {
    const c = getSceneConfigForOrientation("portrait", "gallery");
    expect(c.portraitSafe).toBe(true);
    expect(c.layoutMode.startsWith("portrait_")).toBe(true);
  });
});
