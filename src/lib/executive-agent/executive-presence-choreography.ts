import type {
  AmbientExecutiveSignal,
  AmbientOrbState,
  AmbientSignalSeverity,
  OperationalPresenceMode,
} from "@/lib/executive-agent/executive-ambient-signal-types";

/** Cinematic choreography modes — visual only, advisory presence layer. */
export type CinematicChoreographyMode =
  | "calm"
  | "monitoring"
  | "active"
  | "elevated"
  | "incident"
  | "crisis"
  | "recovery"
  | "strategic";

export type ChoreographyVisualProfile = {
  mode: CinematicChoreographyMode;
  glowRgb: string;
  glowIntensity: number;
  orbSpeed: number;
  hudIntensity: number;
  particleActivity: number;
  ringOpacity: number;
  scanSpeedSec: number;
  atmosphereOpacity: number;
  parallaxStrength: number;
};

const PROFILES: Record<CinematicChoreographyMode, ChoreographyVisualProfile> = {
  calm: {
    mode: "calm",
    glowRgb: "0,163,255",
    glowIntensity: 0.22,
    orbSpeed: 0.85,
    hudIntensity: 0.55,
    particleActivity: 0.35,
    ringOpacity: 0.28,
    scanSpeedSec: 14,
    atmosphereOpacity: 0.35,
    parallaxStrength: 0.12,
  },
  monitoring: {
    mode: "monitoring",
    glowRgb: "0,183,255",
    glowIntensity: 0.32,
    orbSpeed: 1,
    hudIntensity: 0.62,
    particleActivity: 0.45,
    ringOpacity: 0.34,
    scanSpeedSec: 11,
    atmosphereOpacity: 0.42,
    parallaxStrength: 0.16,
  },
  active: {
    mode: "active",
    glowRgb: "34,211,238",
    glowIntensity: 0.42,
    orbSpeed: 1.15,
    hudIntensity: 0.72,
    particleActivity: 0.58,
    ringOpacity: 0.42,
    scanSpeedSec: 9,
    atmosphereOpacity: 0.48,
    parallaxStrength: 0.2,
  },
  elevated: {
    mode: "elevated",
    glowRgb: "251,191,36",
    glowIntensity: 0.48,
    orbSpeed: 1.25,
    hudIntensity: 0.78,
    particleActivity: 0.62,
    ringOpacity: 0.48,
    scanSpeedSec: 7.5,
    atmosphereOpacity: 0.52,
    parallaxStrength: 0.22,
  },
  incident: {
    mode: "incident",
    glowRgb: "251,146,60",
    glowIntensity: 0.55,
    orbSpeed: 1.35,
    hudIntensity: 0.82,
    particleActivity: 0.68,
    ringOpacity: 0.52,
    scanSpeedSec: 6,
    atmosphereOpacity: 0.55,
    parallaxStrength: 0.24,
  },
  crisis: {
    mode: "crisis",
    glowRgb: "244,63,94",
    glowIntensity: 0.68,
    orbSpeed: 1.55,
    hudIntensity: 0.92,
    particleActivity: 0.78,
    ringOpacity: 0.62,
    scanSpeedSec: 4.5,
    atmosphereOpacity: 0.62,
    parallaxStrength: 0.28,
  },
  recovery: {
    mode: "recovery",
    glowRgb: "167,139,250",
    glowIntensity: 0.38,
    orbSpeed: 0.95,
    hudIntensity: 0.66,
    particleActivity: 0.5,
    ringOpacity: 0.38,
    scanSpeedSec: 10,
    atmosphereOpacity: 0.44,
    parallaxStrength: 0.18,
  },
  strategic: {
    mode: "strategic",
    glowRgb: "139,92,246",
    glowIntensity: 0.44,
    orbSpeed: 1.05,
    hudIntensity: 0.74,
    particleActivity: 0.55,
    ringOpacity: 0.44,
    scanSpeedSec: 8.5,
    atmosphereOpacity: 0.5,
    parallaxStrength: 0.21,
  },
};

export function choreographyProfile(mode: CinematicChoreographyMode): ChoreographyVisualProfile {
  return PROFILES[mode];
}

export function mapOperationalModeToChoreography(
  mode: OperationalPresenceMode | undefined,
  orbState?: string | null,
): CinematicChoreographyMode {
  if (orbState === "monitoring") return "monitoring";
  if (orbState === "strategic_analysis") return "strategic";
  if (orbState === "workflow_recovery") return "recovery";
  if (orbState === "crisis_coordination") return "crisis";
  if (orbState === "incident" || orbState === "escalation") return "incident";
  if (orbState === "approval_waiting") return "elevated";
  switch (mode) {
    case "active":
      return "active";
    case "elevated":
      return "elevated";
    case "incident":
      return "incident";
    case "crisis":
      return "crisis";
    case "recovery":
      return "recovery";
    case "strategic":
      return "strategic";
    case "calm":
    default:
      return "calm";
  }
}

export function escalationChoreographyFromSeverity(
  severity: AmbientSignalSeverity | undefined,
): CinematicChoreographyMode | null {
  switch (severity) {
    case "critical":
      return "crisis";
    case "high":
      return "incident";
    case "medium":
      return "elevated";
    case "low":
    case "watch":
      return "monitoring";
    default:
      return null;
  }
}

export function blendChoreographyProfile(
  base: ChoreographyVisualProfile,
  accent: ChoreographyVisualProfile | null,
  accentWeight: number,
): ChoreographyVisualProfile {
  if (!accent || accentWeight <= 0) return base;
  const w = Math.min(1, Math.max(0, accentWeight));
  const lerp = (a: number, b: number) => a + (b - a) * w;
  return {
    ...base,
    glowIntensity: lerp(base.glowIntensity, accent.glowIntensity, w),
    orbSpeed: lerp(base.orbSpeed, accent.orbSpeed, w),
    hudIntensity: lerp(base.hudIntensity, accent.hudIntensity, w),
    particleActivity: lerp(base.particleActivity, accent.particleActivity, w),
    ringOpacity: lerp(base.ringOpacity, accent.ringOpacity, w),
    scanSpeedSec: lerp(base.scanSpeedSec, accent.scanSpeedSec, w),
    atmosphereOpacity: lerp(base.atmosphereOpacity, accent.atmosphereOpacity, w),
    parallaxStrength: lerp(base.parallaxStrength, accent.parallaxStrength, w),
    glowRgb: w > 0.55 ? accent.glowRgb : base.glowRgb,
  };
}

export function orbGlowFromAmbient(orb: AmbientOrbState | null | undefined): string | null {
  if (!orb) return null;
  switch (orb.glowColor) {
    case "amber":
      return "251,191,36";
    case "rose":
      return "244,63,94";
    case "violet":
      return "167,139,250";
    case "cyan":
    default:
      return "0,163,255";
  }
}

export type InterruptionChoreographyLevel = "none" | "pulse" | "rail_flash" | "hud_banner" | "crisis_overlay";

export function interruptionChoreographyLevel(
  severity: AmbientExecutiveSignal["severity"] | undefined,
): InterruptionChoreographyLevel {
  switch (severity) {
    case "critical":
      return "crisis_overlay";
    case "high":
      return "hud_banner";
    case "medium":
      return "rail_flash";
    case "low":
    case "watch":
      return "pulse";
    default:
      return "none";
  }
}
