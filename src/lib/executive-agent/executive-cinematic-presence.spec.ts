import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  choreographyProfile,
  escalationChoreographyFromSeverity,
  interruptionChoreographyLevel,
  mapOperationalModeToChoreography,
} from "./executive-presence-choreography.ts";
import { deriveOrbPulseKind } from "./executive-orb-motion-engine.ts";
import { commandFocusFromPrompt } from "./executive-command-focus.ts";

describe("executive cinematic presence", () => {
  it("maps operational modes to choreography", () => {
    assert.equal(mapOperationalModeToChoreography("crisis", null), "crisis");
    assert.equal(mapOperationalModeToChoreography("calm", "monitoring"), "monitoring");
  });

  it("escalates interruption severity into choreography modes", () => {
    assert.equal(escalationChoreographyFromSeverity("critical"), "crisis");
    assert.equal(interruptionChoreographyLevel("high"), "hud_banner");
  });

  it("derives orb pulse kinds from voice and approval states", () => {
    assert.equal(
      deriveOrbPulseKind({
        voiceSpeaking: true,
        voiceListening: false,
        processing: false,
        approvalGlow: false,
        escalationPulse: false,
        ambientPulse: false,
      }),
      "voice",
    );
    assert.equal(
      deriveOrbPulseKind({
        voiceSpeaking: false,
        voiceListening: false,
        processing: false,
        approvalGlow: true,
        escalationPulse: false,
        ambientPulse: false,
      }),
      "approval",
    );
  });

  it("expands HUD in command focus mode", () => {
    const idle = commandFocusFromPrompt(null);
    const active = commandFocusFromPrompt("analytics");
    assert.equal(idle.active, false);
    assert.ok(active.hudScale > idle.hudScale);
    assert.ok(choreographyProfile("crisis").glowIntensity > choreographyProfile("calm").glowIntensity);
  });
});
