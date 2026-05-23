export type OrbPulseKind = "ambient" | "escalation" | "approval" | "signal" | "voice" | "processing";

export type OrbMotionState = {
  intensity: number;
  smoothedIntensity: number;
  ringExpansion: number;
  driftX: number;
  driftY: number;
  pulseKind: OrbPulseKind;
  ripplePhase: number;
  energyMultiplier: number;
};

export function lerpOrb(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

export function deriveOrbPulseKind(opts: {
  voiceSpeaking: boolean;
  voiceListening: boolean;
  processing: boolean;
  approvalGlow: boolean;
  escalationPulse: boolean;
  ambientPulse: boolean;
}): OrbPulseKind {
  if (opts.voiceSpeaking || opts.voiceListening) return "voice";
  if (opts.processing) return "processing";
  if (opts.approvalGlow) return "approval";
  if (opts.escalationPulse) return "escalation";
  if (opts.ambientPulse) return "signal";
  return "ambient";
}

export function computeOrbMotionTarget(opts: {
  baseIntensity: number;
  voiceRms: number;
  voiceSpeaking: boolean;
  voiceListening: boolean;
  profileEnergy: number;
  choreographySpeed: number;
  timeSec: number;
}): Pick<OrbMotionState, "intensity" | "ringExpansion" | "driftX" | "driftY" | "ripplePhase" | "energyMultiplier"> {
  const voiceBoost = opts.voiceSpeaking ? opts.voiceRms * 0.55 : opts.voiceListening ? opts.voiceRms * 0.35 : 0;
  const intensity = Math.min(1, opts.baseIntensity * opts.profileEnergy + voiceBoost);
  const ringExpansion = opts.voiceSpeaking
    ? 0.08 + opts.voiceRms * 0.22
    : opts.voiceListening
      ? 0.04 + opts.voiceRms * 0.12
      : 0.02 + Math.sin(opts.timeSec * opts.choreographySpeed) * 0.015;
  const driftX = Math.sin(opts.timeSec * 0.31 * opts.choreographySpeed) * 0.012;
  const driftY = Math.cos(opts.timeSec * 0.27 * opts.choreographySpeed) * 0.01;
  return {
    intensity,
    ringExpansion,
    driftX,
    driftY,
    ripplePhase: (opts.timeSec * opts.choreographySpeed) % 1,
    energyMultiplier: 0.85 + intensity * 0.35,
  };
}

export function smoothOrbMotion(prev: OrbMotionState, target: OrbMotionState, deltaFactor: number): OrbMotionState {
  const t = Math.min(1, Math.max(0.04, deltaFactor));
  return {
    ...target,
    smoothedIntensity: lerpOrb(prev.smoothedIntensity, target.intensity, t),
    intensity: target.intensity,
    ringExpansion: lerpOrb(prev.ringExpansion, target.ringExpansion, t * 1.4),
    driftX: lerpOrb(prev.driftX, target.driftX, t),
    driftY: lerpOrb(prev.driftY, target.driftY, t),
  };
}

export function orbPulseCssVars(motion: OrbMotionState, glowRgb: string): Record<string, string> {
  return {
    "--orb-glow-rgb": glowRgb,
    "--orb-intensity": String(motion.smoothedIntensity.toFixed(3)),
    "--orb-ring-expansion": String(motion.ringExpansion.toFixed(3)),
    "--orb-drift-x": `${(motion.driftX * 100).toFixed(2)}px`,
    "--orb-drift-y": `${(motion.driftY * 100).toFixed(2)}px`,
    "--orb-ripple-phase": String(motion.ripplePhase.toFixed(3)),
    "--orb-energy": String(motion.energyMultiplier.toFixed(3)),
  };
}
