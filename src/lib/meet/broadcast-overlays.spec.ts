/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  getDefaultOverlayState,
  isAllowedOverlayUrl,
  mergeBroadcastOverlayPatch,
  mergeOverlaysIntoRenderModel,
  validateBroadcastOverlayState,
} from "./broadcast-overlays";
import type { BroadcastCompositorRenderModel } from "./broadcast-compositor";

const baseModel: BroadcastCompositorRenderModel = {
  layoutMode: "gallery",
  liveKitLayout: "grid",
  portraitSafe: false,
  branding: {},
  showParticipantNames: true,
  showMutedIndicators: true,
  showFooter: false,
  highlightedParticipantIds: [],
  primarySpeakerId: null,
  screenShareActive: false,
  programNotes: [],
  orientation: "landscape",
  providerHints: { platforms: [], anyPortraitCapable: false },
};

describe("broadcast-overlays", () => {
  it("isAllowedOverlayUrl accepts http(s) only", () => {
    expect(isAllowedOverlayUrl("https://example.com/x")).toBe(true);
    expect(isAllowedOverlayUrl("http://example.com")).toBe(true);
    expect(isAllowedOverlayUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedOverlayUrl("data:text/html,hi")).toBe(false);
    expect(isAllowedOverlayUrl("ftp://x")).toBe(false);
  });

  it("validateBroadcastOverlayState rejects bad CTA url", () => {
    const base = getDefaultOverlayState(1, 1);
    const bad = mergeBroadcastOverlayPatch(base, {
      ctaBanner: { visible: true, buttonUrl: "javascript:void(0)" },
    });
    const v = validateBroadcastOverlayState({ ...bad, updatedAt: new Date().toISOString(), updatedByUserId: 1 });
    expect(v.ok).toBe(false);
  });

  it("validateBroadcastOverlayState accepts valid state", () => {
    const s = getDefaultOverlayState(3, 9);
    const v = validateBroadcastOverlayState(s);
    expect(v.ok).toBe(true);
  });

  it("mergeOverlaysIntoRenderModel attaches overlays to model", () => {
    const st = mergeBroadcastOverlayPatch(getDefaultOverlayState(1, 1), {
      lowerThird: { visible: true, headline: "A" },
    });
    const liveScene = {
      broadcastSessionId: 1,
      sceneType: "program" as const,
      layoutMode: "gallery" as const,
      branding: {},
      showParticipantNames: true,
      showMutedIndicators: true,
      showFooter: false,
      portraitSafe: true,
      screenSharePriority: false,
      updatedAt: new Date().toISOString(),
      updatedByUserId: 1,
    };
    const merged = mergeOverlaysIntoRenderModel(baseModel, { ...st, updatedAt: liveScene.updatedAt, updatedByUserId: 1 }, liveScene);
    expect(merged.overlays?.lowerThird.visible).toBe(true);
    expect(merged.overlays?.portraitSafe).toBe(true);
  });
});
