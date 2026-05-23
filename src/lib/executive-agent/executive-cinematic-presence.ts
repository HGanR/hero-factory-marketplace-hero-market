"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AmbientExecutiveSignal,
  AmbientOrbState,
  ExecutiveAmbientSignalOverview,
  OperationalPresenceMode,
} from "@/lib/executive-agent/executive-ambient-signal-types";
import {
  blendChoreographyProfile,
  choreographyProfile,
  escalationChoreographyFromSeverity,
  interruptionChoreographyLevel,
  mapOperationalModeToChoreography,
  orbGlowFromAmbient,
  type CinematicChoreographyMode,
  type ChoreographyVisualProfile,
  type InterruptionChoreographyLevel,
} from "@/lib/executive-agent/executive-presence-choreography";
import type { ExecutiveCommandPromptId } from "@/lib/executive-agent/executive-command-prompts";
import {
  computeOrbMotionTarget,
  deriveOrbPulseKind,
  orbPulseCssVars,
  smoothOrbMotion,
  type OrbMotionState,
  type OrbPulseKind,
} from "@/lib/executive-agent/executive-orb-motion-engine";
import {
  atmosphereCssVars,
  atmosphereFromProfile,
  type AtmosphereLayerConfig,
} from "@/lib/executive-agent/executive-operational-atmosphere";
import {
  hudTransitionForPrompt,
  hudTransitionStyleRecord,
  type HudTransitionTokens,
} from "@/lib/executive-agent/executive-hud-transition-engine";
import {
  commandFocusCssVars,
  commandFocusFromPrompt,
  type CommandFocusState,
} from "@/lib/executive-agent/executive-command-focus";
import { usePresencePerformanceGovernance } from "@/lib/executive-agent/executive-presence-performance";

export type { CinematicChoreographyMode, ChoreographyVisualProfile, OrbPulseKind, CommandFocusState, HudTransitionTokens, InterruptionChoreographyLevel };
export { interruptionChoreographyLevel };

export type ExecutiveCinematicPresenceInput = {
  presenceMode?: OperationalPresenceMode;
  ambientOverview?: ExecutiveAmbientSignalOverview | null;
  ambientOrbState?: AmbientOrbState | null;
  interruptions?: AmbientExecutiveSignal[];
  baseOrbIntensity: number;
  orbMode: string;
  voiceRms: number;
  voiceSpeaking: boolean;
  voiceListening: boolean;
  simSpeaking: boolean;
  voiceApprovalFlash: boolean;
  processing: boolean;
  activePromptId: ExecutiveCommandPromptId | null;
};

export type ExecutiveCinematicPresenceState = {
  choreographyMode: CinematicChoreographyMode;
  profile: ChoreographyVisualProfile;
  orbMotion: OrbMotionState;
  orbPulseKind: OrbPulseKind;
  orbCssVars: Record<string, string>;
  atmosphere: AtmosphereLayerConfig;
  atmosphereCssVars: Record<string, string>;
  hudTransition: HudTransitionTokens;
  hudStyle: Record<string, string | number>;
  commandFocus: CommandFocusState;
  commandFocusCssVars: Record<string, string>;
  performance: ReturnType<typeof usePresencePerformanceGovernance>;
  topInterruptionLevel: InterruptionChoreographyLevel;
  cinematicOrbIntensity: number;
  voiceWaveform: number[];
};

export function useExecutiveCinematicPresence(input: ExecutiveCinematicPresenceInput): ExecutiveCinematicPresenceState {
  const performance = usePresencePerformanceGovernance();
  const prevPromptRef = useRef<ExecutiveCommandPromptId | null>(null);
  const [activating, setActivating] = useState(false);
  const motionRef = useRef<OrbMotionState>({
    intensity: input.baseOrbIntensity,
    smoothedIntensity: input.baseOrbIntensity,
    ringExpansion: 0,
    driftX: 0,
    driftY: 0,
    pulseKind: "ambient",
    ripplePhase: 0,
    energyMultiplier: 1,
  });
  const [orbMotion, setOrbMotion] = useState<OrbMotionState>(motionRef.current);
  const [voiceWaveform, setVoiceWaveform] = useState<number[]>([]);

  useEffect(() => {
    if (input.activePromptId && input.activePromptId !== prevPromptRef.current) {
      setActivating(true);
      const id = window.setTimeout(() => setActivating(false), 520);
      prevPromptRef.current = input.activePromptId;
      return () => window.clearTimeout(id);
    }
    if (!input.activePromptId) prevPromptRef.current = null;
  }, [input.activePromptId]);

  const topSeverity = input.interruptions?.[0]?.severity;
  const escalationMode = escalationChoreographyFromSeverity(topSeverity);
  const baseChoreography = mapOperationalModeToChoreography(
    input.presenceMode ?? input.ambientOverview?.presenceMode,
    input.orbMode,
  );
  const choreographyMode: CinematicChoreographyMode = escalationMode ?? baseChoreography;
  const baseProfile = choreographyProfile(choreographyMode);
  const accentProfile = escalationMode ? choreographyProfile(escalationMode) : null;
  const profile = blendChoreographyProfile(baseProfile, accentProfile, topSeverity === "critical" ? 0.85 : topSeverity === "high" ? 0.55 : 0);

  const glowRgb = orbGlowFromAmbient(input.ambientOrbState) ?? profile.glowRgb;

  const orbPulseKind = deriveOrbPulseKind({
    voiceSpeaking: input.voiceSpeaking || input.simSpeaking,
    voiceListening: input.voiceListening,
    processing: input.processing,
    approvalGlow: input.voiceApprovalFlash,
    escalationPulse: Boolean(escalationMode && escalationMode !== "calm"),
    ambientPulse: input.ambientOrbState?.pulseActive ?? false,
  });

  useEffect(() => {
    if (performance.animationsPaused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last) / 1000;
      last = now;
      const timeSec = now / 1000;
      const targetPartial = computeOrbMotionTarget({
        baseIntensity: input.baseOrbIntensity,
        voiceRms: input.voiceRms,
        voiceSpeaking: input.voiceSpeaking || input.simSpeaking,
        voiceListening: input.voiceListening,
        profileEnergy: 0.75 + profile.glowIntensity,
        choreographySpeed: profile.orbSpeed,
        timeSec,
      });
      const target: OrbMotionState = { ...targetPartial, pulseKind: orbPulseKind, smoothedIntensity: targetPartial.intensity };
      const next = smoothOrbMotion(motionRef.current, target, dt * 4 * performance.maxFpsScale);
      motionRef.current = next;
      setOrbMotion(next);
      if (input.voiceSpeaking || input.simSpeaking) {
        const bands = Array.from({ length: 24 }, (_, i) =>
          Math.max(0.05, Math.min(1, input.voiceRms * 1.8 + Math.sin(timeSec * 8 + i * 0.45) * 0.12)),
        );
        setVoiceWaveform(bands);
      } else {
        setVoiceWaveform([]);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    input.baseOrbIntensity,
    input.voiceRms,
    input.voiceSpeaking,
    input.voiceListening,
    input.simSpeaking,
    orbPulseKind,
    profile.glowIntensity,
    profile.orbSpeed,
    performance.animationsPaused,
    performance.maxFpsScale,
  ]);

  const atmosphere = atmosphereFromProfile(profile, {
    allowScanLines: performance.allowScanLines,
    animationsPaused: performance.animationsPaused,
  });

  const hudTransition = hudTransitionForPrompt(
    input.activePromptId,
    prevPromptRef.current,
    activating,
  );
  const commandFocus = commandFocusFromPrompt(input.activePromptId);

  const cinematicOrbIntensity = Math.min(
    1,
    orbMotion.smoothedIntensity * profile.particleActivity * orbMotion.energyMultiplier,
  );

  return useMemo(
    () => ({
      choreographyMode,
      profile,
      orbMotion,
      orbPulseKind,
      orbCssVars: orbPulseCssVars(orbMotion, glowRgb),
      atmosphere,
      atmosphereCssVars: atmosphereCssVars(atmosphere, glowRgb),
      hudTransition,
      hudStyle: hudTransitionStyleRecord(hudTransition),
      commandFocus,
      commandFocusCssVars: commandFocusCssVars(commandFocus),
      performance,
      topInterruptionLevel: interruptionChoreographyLevel(topSeverity),
      cinematicOrbIntensity,
      voiceWaveform,
    }),
    [
      choreographyMode,
      profile,
      orbMotion,
      orbPulseKind,
      glowRgb,
      atmosphere,
      hudTransition,
      commandFocus,
      performance,
      topSeverity,
      cinematicOrbIntensity,
      voiceWaveform,
    ],
  );
}
