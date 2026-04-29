/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import {
  deriveBroadcastAutoDirectingDecision,
  getDefaultBroadcastAutoDirectingPolicy,
  shouldAutoApplyBroadcastDirectingDecision,
  validateBroadcastAutoDirectingPolicy,
} from "./broadcast-auto-directing";

describe("broadcast-auto-directing", () => {
  it("validateBroadcastAutoDirectingPolicy accepts defaults", () => {
    const v = validateBroadcastAutoDirectingPolicy({});
    expect(v.ok).toBe(true);
  });

  it("recommends screenshare_focus when sharing and policy prefers it", () => {
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "suggest_only";
    const d = deriveBroadcastAutoDirectingDecision(
      {
        activeSpeakerIds: ["x"],
        participantCount: 1,
        screenShareActive: true,
        signalsWeak: false,
      },
      { sceneType: "program", layoutMode: "gallery" },
      policy,
      { platforms: [], anyPortraitCapable: false },
      { lastDominantSpeakerId: null, lastFlipAtIso: null },
      new Date().toISOString()
    );
    expect(d.recommendedLayoutMode).toBe("screenshare_focus");
    expect(d.confidence).toBe("high");
  });

  it("shouldAutoApply respects manual override", () => {
    const now = "2026-01-01T12:00:00.000Z";
    const policy = getDefaultBroadcastAutoDirectingPolicy();
    policy.mode = "auto_apply";
    const decision = {
      recommendedLayoutMode: "speaker" as const,
      reason: "test",
      confidence: "medium" as const,
      shouldApply: true,
    };
    expect(
      shouldAutoApplyBroadcastDirectingDecision({
        decision,
        policy,
        manualOverrideUntilIso: "2026-01-01T13:00:00.000Z",
        nowIso: now,
      })
    ).toBe(false);
  });
});
