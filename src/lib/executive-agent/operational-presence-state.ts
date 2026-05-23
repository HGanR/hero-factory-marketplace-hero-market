import type {
  AmbientExecutiveSignal,
  AmbientOrbTelemetry,
  OperationalPresenceMode,
} from "@/lib/executive-agent/executive-ambient-signal-types";
import { dominantSeverity, SEVERITY_RANK } from "@/lib/executive-agent/executive-signal-ranking";

export type OperationalPresenceInput = {
  criticalCount: number;
  highCount: number;
  escalationDensity: number;
  workflowPausedCount: number;
  workflowAtRiskCount: number;
  pendingApprovals: number;
  governanceAnomaly: boolean;
  crisisLevel: string;
  kpiDriftScore: number;
};

export function deriveOperationalPresenceMode(input: OperationalPresenceInput): OperationalPresenceMode {
  if (input.crisisLevel === "critical" || input.criticalCount >= 2) return "crisis";
  if (input.workflowPausedCount > 0) return "recovery";
  if (input.criticalCount >= 1 || input.crisisLevel === "high") return "incident";
  if (input.escalationDensity >= 0.35 || input.highCount >= 2) return "elevated";
  if (input.kpiDriftScore >= 0.45 || input.governanceAnomaly || input.workflowAtRiskCount >= 2) return "strategic";
  if (
    input.pendingApprovals >= 1 ||
    input.highCount >= 1 ||
    input.workflowAtRiskCount >= 1 ||
    input.escalationDensity > 0
  ) {
    return "active";
  }
  return "calm";
}

export function buildAmbientOrbTelemetry(
  signals: AmbientExecutiveSignal[],
  input: OperationalPresenceInput,
): AmbientOrbTelemetry {
  const dom = dominantSeverity(signals);
  const escalationSignals = signals.filter((s) => s.category === "escalation" || s.category === "operator");
  const escalationDensity = Math.min(1, escalationSignals.length / Math.max(1, signals.length));
  const onboardingSpike = signals.some(
    (s) => s.category === "registration" || s.category === "onboarding",
  );
  const intensityBase = (SEVERITY_RANK[dom] ?? 1) / 5;
  const workflowActive = input.workflowAtRiskCount + input.workflowPausedCount;
  const intensity = Math.min(
    1,
    intensityBase * 0.5 +
      escalationDensity * 0.25 +
      (input.kpiDriftScore >= 0.4 ? 0.15 : 0) +
      (onboardingSpike ? 0.1 : 0),
  );

  return {
    intensity,
    pulseRate: dom === "critical" || dom === "high" ? "fast" : dom === "medium" ? "normal" : "slow",
    escalationDensity,
    activeWorkflowCount: workflowActive,
    governanceAnomaly: input.governanceAnomaly,
    onboardingSpike,
    dominantSeverity: dom,
  };
}

export const PRESENCE_MODE_LABEL: Record<OperationalPresenceMode, string> = {
  calm: "Calm",
  active: "Active",
  elevated: "Elevated",
  incident: "Incident",
  crisis: "Crisis",
  recovery: "Recovery",
  strategic: "Strategic",
};
