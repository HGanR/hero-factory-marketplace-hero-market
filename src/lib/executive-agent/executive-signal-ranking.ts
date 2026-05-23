import type { AmbientExecutiveSignal, AmbientSignalSeverity } from "@/lib/executive-agent/executive-ambient-signal-types";

export const SEVERITY_RANK: Record<AmbientSignalSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  watch: 1,
};

const CATEGORY_RELEVANCE: Record<string, number> = {
  escalation: 0.95,
  governance: 0.92,
  approval: 0.9,
  kpi: 0.88,
  workflow: 0.85,
  operator: 0.82,
  smart_trust: 0.8,
  bentley_campaign: 0.78,
  executive_inbox: 0.75,
  onboarding: 0.72,
  registration: 0.7,
  jarva_activity: 0.68,
  reality_activity: 0.65,
};

export function scoreExecutiveRelevance(
  severity: AmbientSignalSeverity,
  category: string,
  opts?: { recencyMs?: number; memoryBoost?: number },
): number {
  const base = (SEVERITY_RANK[severity] ?? 1) / 5;
  const cat = CATEGORY_RELEVANCE[category] ?? 0.5;
  let recency = 0.5;
  if (opts?.recencyMs != null) {
    const hours = opts.recencyMs / (1000 * 60 * 60);
    recency = hours <= 1 ? 1 : hours <= 6 ? 0.85 : hours <= 24 ? 0.65 : 0.4;
  }
  const memory = opts?.memoryBoost ?? 0;
  return Math.min(1, base * 0.45 + cat * 0.35 + recency * 0.15 + memory * 0.05);
}

export function rankAmbientSignals(signals: AmbientExecutiveSignal[]): AmbientExecutiveSignal[] {
  return [...signals].sort((a, b) => {
    const sev = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0);
    if (sev !== 0) return sev;
    return b.relevanceScore - a.relevanceScore;
  });
}

export function meetsInterruptionThreshold(signal: AmbientExecutiveSignal): boolean {
  if (!signal.interruptEligible) return false;
  return (
    signal.severity === "critical" ||
    signal.severity === "high" ||
    (signal.severity === "medium" && signal.relevanceScore >= 0.72)
  );
}

export function dominantSeverity(signals: AmbientExecutiveSignal[]): AmbientSignalSeverity {
  if (!signals.length) return "watch";
  const ranked = rankAmbientSignals(signals);
  return ranked[0]!.severity;
}
