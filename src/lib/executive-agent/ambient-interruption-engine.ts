import type { AmbientExecutiveSignal } from "@/lib/executive-agent/executive-ambient-signal-types";
import { meetsInterruptionThreshold, rankAmbientSignals } from "@/lib/executive-agent/executive-signal-ranking";

export type AmbientInterruption = AmbientExecutiveSignal & {
  isInterruption: true;
  interruptionReason: string;
};

const INTERRUPTION_REASON: Partial<Record<string, string>> = {
  onboarding: "onboarding_readiness",
  governance: "governance_anomaly",
  kpi: "kpi_drift",
  bentley_campaign: "launch_degradation",
  workflow: "workflow_instability",
  escalation: "escalation_surge",
  operator: "operator_overload",
  approval: "approval_backlog_acceleration",
};

export function buildAmbientInterruptions(signals: AmbientExecutiveSignal[]): AmbientInterruption[] {
  const ranked = rankAmbientSignals(signals);
  const out: AmbientInterruption[] = [];

  for (const signal of ranked) {
    if (!meetsInterruptionThreshold(signal)) continue;
    out.push({
      ...signal,
      isInterruption: true,
      interruptionReason: INTERRUPTION_REASON[signal.category] ?? "operational_advisory",
    });
    if (out.length >= 8) break;
  }

  return out;
}

export function pickTopInterruption(signals: AmbientExecutiveSignal[]): AmbientInterruption | null {
  const list = buildAmbientInterruptions(signals);
  return list[0] ?? null;
}
