/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { suggestPortraitSafeForDestinations, suggestSceneLayoutForDestinations } from "./broadcast-scene-suggestions";

describe("broadcast-scene-suggestions", () => {
  it("suggests portrait_speaker for instagram-only", () => {
    expect(suggestSceneLayoutForDestinations([{ platform: "instagram" }])).toBe("portrait_speaker");
  });

  it("suggests portrait_split for mixed portrait and landscape platforms", () => {
    expect(suggestSceneLayoutForDestinations([{ platform: "instagram" }, { platform: "twitch" }])).toBe(
      "portrait_split"
    );
  });

  it("suggests speaker for twitch-only (landscape-first)", () => {
    expect(suggestSceneLayoutForDestinations([{ platform: "twitch" }])).toBe("speaker");
  });

  it("suggestPortraitSafeForDestinations is true when any destination supports portrait", () => {
    expect(suggestPortraitSafeForDestinations([{ platform: "tiktok" }])).toBe(true);
    expect(suggestPortraitSafeForDestinations([{ platform: "twitch" }])).toBe(false);
  });
});
