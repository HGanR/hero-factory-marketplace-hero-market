import type {
  AmbientExecutiveSignal,
  AmbientOrbState,
  AmbientOrbTelemetry,
  OperationalPresenceMode,
} from "@/lib/executive-agent/executive-ambient-signal-types";
import type { OperationalIntelligenceState } from "@/lib/executive-agent/executive-presence-types";
import { buildAmbientOrbTelemetry } from "@/lib/executive-agent/operational-presence-state";
import { dominantSeverity } from "@/lib/executive-agent/executive-signal-ranking";

export type AmbientOrbBlendInput = {
  presenceOrb: OperationalIntelligenceState;
  signals: AmbientExecutiveSignal[];
  presenceInput: Parameters<typeof buildAmbientOrbTelemetry>[1];
  presenceMode: OperationalPresenceMode;
};

const MODE_GLOW: Record<OperationalPresenceMode, AmbientOrbState["glowColor"]> = {
  calm: "cyan",
  active: "cyan",
  elevated: "amber",
  incident: "rose",
  crisis: "rose",
  recovery: "violet",
  strategic: "violet",
};

export function deriveAmbientOrbState(input: AmbientOrbBlendInput): AmbientOrbState {
  const telemetry = buildAmbientOrbTelemetry(input.signals, input.presenceInput);
  const dom = dominantSeverity(input.signals);
  const blendedIntensity = Math.min(
    1,
    telemetry.intensity * 0.65 +
      (input.presenceMode === "crisis" || input.presenceMode === "incident" ? 0.25 : 0) +
      (input.presenceOrb === "crisis_coordination" ? 0.1 : 0),
  );

  const pulseActive =
    dom === "critical" ||
    dom === "high" ||
    input.presenceMode === "incident" ||
    input.presenceMode === "crisis" ||
    telemetry.escalationDensity >= 0.3;

  const label =
    input.presenceMode === "crisis"
      ? "Crisis coordination"
      : telemetry.governanceAnomaly
        ? "Governance watch"
        : telemetry.onboardingSpike
          ? "Onboarding pulse"
          : telemetry.escalationDensity >= 0.25
            ? "Escalation density"
            : input.presenceOrb.replace(/_/g, " ");

  return {
    presenceOrb: input.presenceOrb,
    ambientTelemetry: telemetry,
    blendedIntensity,
    pulseActive,
    glowColor: MODE_GLOW[input.presenceMode] ?? "cyan",
    label,
  };
}
