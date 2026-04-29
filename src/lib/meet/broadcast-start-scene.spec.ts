/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { resolveBroadcastStartScene } from "./broadcast-start-scene";
import { getDefaultSceneConfig } from "./broadcast-scene";
import * as presets from "./broadcast-scene-presets";

jest.mock("./broadcast-scene-presets", () => ({
  getScenePresetForUser: jest.fn(),
}));

const mockPreset = presets.getScenePresetForUser as jest.MockedFunction<typeof presets.getScenePresetForUser>;

describe("broadcast-start-scene", () => {
  beforeEach(() => {
    mockPreset.mockReset();
  });

  it("uses legacy layoutMode when no preset or sceneConfig", async () => {
    const r = await resolveBroadcastStartScene({ userId: 1, legacyLayoutMode: "speaker" });
    expect(r.liveKitLayout).toBe("speaker");
    expect(r.snapshot.layoutMode).toBe("speaker");
  });

  it("loads preset when valid", async () => {
    mockPreset.mockResolvedValueOnce({
      id: 9,
      userId: 1,
      name: "Main",
      configJson: { ...getDefaultSceneConfig(), layoutMode: "portrait_speaker" },
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const r = await resolveBroadcastStartScene({ userId: 1, scenePresetId: 9 });
    expect(r.snapshot.appliedPresetId).toBe(9);
    expect(r.snapshot.layoutMode).toBe("portrait_speaker");
    expect(r.liveKitLayout).toBe("single-speaker");
  });

  it("falls back when preset missing", async () => {
    mockPreset.mockResolvedValueOnce(null);
    const r = await resolveBroadcastStartScene({ userId: 1, scenePresetId: 99, legacyLayoutMode: "grid" });
    expect(r.resolveWarnings.some((w) => /not found/i.test(w))).toBe(true);
    expect(r.snapshot.appliedPresetId).toBeNull();
  });

  it("uses inline sceneConfig when preset id is missing", async () => {
    mockPreset.mockResolvedValueOnce(null);
    const r = await resolveBroadcastStartScene({
      userId: 1,
      scenePresetId: 99,
      sceneConfig: { ...getDefaultSceneConfig(), layoutMode: "portrait_split", portraitSafe: true },
      legacyLayoutMode: "grid",
    });
    expect(r.snapshot.layoutMode).toBe("portrait_split");
    expect(r.snapshot.portraitSafe).toBe(true);
    expect(r.snapshot.appliedPresetId).toBeNull();
  });
});
