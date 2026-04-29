/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  buildLiveSceneRenderModel,
  defaultLiveSceneCopy,
  getDefaultLiveSceneStateFromSession,
  mergeBaseRenderModelWithLiveScene,
  mergeLiveScenePatch,
  validateLiveSceneState,
} from "./broadcast-live-scenes";
import type { BroadcastProgramState } from "./broadcast-program";

const baseProgramState: BroadcastProgramState = {
  layoutMode: "gallery",
  portraitSafe: false,
  branding: {},
  primarySpeakerId: "u1",
  highlightedParticipantIds: ["u1", "u2"],
  screenShareActive: true,
  programNotes: ["n1"],
  providerHints: { platforms: ["youtube"], anyPortraitCapable: false },
};

const baseModel = {
  layoutMode: "gallery" as const,
  liveKitLayout: "grid" as const,
  portraitSafe: false,
  branding: {},
  showParticipantNames: true,
  showMutedIndicators: true,
  showFooter: false,
  highlightedParticipantIds: ["u1", "u2"],
  primarySpeakerId: "u1" as string | null,
  screenShareActive: true,
  programNotes: ["n1"],
  orientation: "landscape" as const,
  providerHints: { platforms: ["youtube"], anyPortraitCapable: false },
};

describe("broadcast-live-scenes", () => {
  it("validateLiveSceneState rejects bad input", () => {
    expect(validateLiveSceneState(null).ok).toBe(false);
    expect(validateLiveSceneState({}).ok).toBe(false);
  });

  it("validateLiveSceneState accepts a well-formed state", () => {
    const s = getDefaultLiveSceneStateFromSession(
      { id: 5, userId: 9, sceneConfigJson: null, layoutMode: "speaker" },
      9
    );
    const v = validateLiveSceneState(s);
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.state.broadcastSessionId).toBe(5);
  });

  it("mergeLiveScenePatch applies partial updates", () => {
    const base = getDefaultLiveSceneStateFromSession(
      { id: 1, userId: 2, sceneConfigJson: null, layoutMode: "grid" },
      2
    );
    const next = mergeLiveScenePatch(base, { sceneType: "brb", layoutMode: "speaker" });
    expect(next.sceneType).toBe("brb");
    expect(next.layoutMode).toBe("speaker");
  });

  it("mergeBaseRenderModelWithLiveScene keeps program highlights but overrides layout", () => {
    const live = mergeLiveScenePatch(
      getDefaultLiveSceneStateFromSession({ id: 1, userId: 1, sceneConfigJson: null, layoutMode: "gallery" }, 1),
      { layoutMode: "speaker", sceneType: "program" }
    );
    const m = mergeBaseRenderModelWithLiveScene(baseModel, {
      ...live,
      updatedAt: new Date().toISOString(),
      updatedByUserId: 1,
    });
    expect(m.ok).toBe(true);
    if (m.ok) {
      expect(m.model.layoutMode).toBe("speaker");
      expect(m.model.highlightedParticipantIds).toEqual(["u1", "u2"]);
      expect(m.model.egressLiveSceneType).toBe("program");
    }
  });

  it("mergeBaseRenderModelWithLiveScene clears program fields for intro slate", () => {
    const live = mergeLiveScenePatch(
      getDefaultLiveSceneStateFromSession({ id: 1, userId: 1, sceneConfigJson: null, layoutMode: "gallery" }, 1),
      { sceneType: "intro" }
    );
    const m = mergeBaseRenderModelWithLiveScene(baseModel, {
      ...live,
      updatedAt: new Date().toISOString(),
      updatedByUserId: 1,
    });
    expect(m.ok).toBe(true);
    if (m.ok) {
      expect(m.model.egressLiveSceneType).toBe("intro");
      expect(m.model.highlightedParticipantIds).toEqual([]);
      expect(m.model.screenShareActive).toBe(false);
      expect(m.model.liveSceneHeadline).toBeTruthy();
    }
  });

  it("buildLiveSceneRenderModel builds slate copy", () => {
    const st = mergeLiveScenePatch(
      getDefaultLiveSceneStateFromSession({ id: 1, userId: 1, sceneConfigJson: null, layoutMode: "gallery" }, 1),
      { sceneType: "brb" }
    );
    const full = { ...st, updatedAt: new Date().toISOString(), updatedByUserId: 1 };
    const v = validateLiveSceneState(full);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const model = buildLiveSceneRenderModel(v.state, baseProgramState, { platforms: ["youtube"] });
    expect(model.egressLiveSceneType).toBe("brb");
    expect(defaultLiveSceneCopy("brb").headline.length).toBeGreaterThan(0);
  });
});
