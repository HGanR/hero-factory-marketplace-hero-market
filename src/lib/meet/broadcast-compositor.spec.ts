/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { getDefaultSceneConfig } from "./broadcast-scene";
import {
  buildBroadcastCompositorRenderModel,
  shouldUseRenderedCompositor,
  validateBroadcastCompositorRenderModel,
} from "./broadcast-compositor";
import { buildBroadcastProgramState } from "./broadcast-program";

describe("broadcast-compositor", () => {
  it("shouldUseRenderedCompositor respects OR of flags", () => {
    const c = getDefaultSceneConfig();
    expect(shouldUseRenderedCompositor(c, { globalEnabled: false, userEnabled: false })).toBe(false);
    expect(shouldUseRenderedCompositor(c, { globalEnabled: true, userEnabled: false })).toBe(true);
    expect(shouldUseRenderedCompositor(c, { globalEnabled: false, userEnabled: true })).toBe(true);
  });

  it("buildBroadcastCompositorRenderModel maps liveKit layout", () => {
    const scene = { ...getDefaultSceneConfig(), layoutMode: "portrait_speaker" as const };
    const prog = buildBroadcastProgramState(scene, { participantIds: [], screenShareTrackPublished: false }, {
      platforms: ["twitch"],
      anyPortraitCapable: false,
    });
    const m = buildBroadcastCompositorRenderModel(scene, prog, { platforms: ["twitch"] });
    expect(m.liveKitLayout).toBe("single-speaker");
    expect(m.providerHints.platforms).toContain("twitch");
  });

  it("validateBroadcastCompositorRenderModel rejects bad liveKitLayout", () => {
    const r = validateBroadcastCompositorRenderModel({ liveKitLayout: "nope", orientation: "auto" });
    expect(r.ok).toBe(false);
  });
});
