/**
 * Multi-scenario comparison for saved or ad hoc policy workbench runs (dry-run outputs).
 */

import type { BentleySimulationComparison } from "@/lib/revenue-os/simulation-comparator";

export type BentleyScenarioCompareInput = {
  scenarios: Array<{
    id: string;
    name?: string;
    /** e.g. autonomous | cadence | notifications | blended */
    scenarioType?: string | null;
    comparisonJson?: Record<string, unknown> | null;
    riskSummaryJson?: Record<string, unknown> | null;
    /** Short note for matrix (from saved run or UI). */
    recommendationNote?: string | null;
  }>;
  /** When true, UI may emphasize paired baseline vs contrast (metadata only). */
  pairedScenarioMode?: boolean;
  /** Preset id for guidance copy (metadata only). */
  recommendationPreset?: string | null;
};

export type BentleyScenarioMetrics = {
  id: string;
  name: string;
  scenarioType: string;
  addedAutoActions: number;
  removedAutoActions: number;
  addedApprovals: number;
  reducedApprovals: number;
  increasedRiskFlags: number;
  notificationDelta: number | null;
  queueHeuristicDelta: number | null;
  handoffVolumeDelta: number | null;
  connectorBurdenScore: number;
  handoffAutomationDelta: number;
  raw?: BentleySimulationComparison | null;
};

export type RichScenarioCompareRow = {
  id: string;
  name: string;
  scenarioType: string;
  riskLevel: "low" | "medium" | "high";
  addedAutoActions: number;
  removedAutoActions: number;
  addedApprovals: number;
  removedApprovals: number;
  changedNotifications: number | null;
  changedQueueStates: number | null;
  handoffVolumeDelta: number | null;
  recommendationNote: string;
  /** Per-metric highlight for matrix cells */
  highlights: Record<string, "best" | "worst" | "neutral">;
};

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return 0;
}

function parseComparison(raw: Record<string, unknown> | null | undefined): BentleySimulationComparison | null {
  if (!raw || typeof raw !== "object") return null;
  const addedAutoActions = num(raw.addedAutoActions);
  const removedAutoActions = num(raw.removedAutoActions);
  const addedApprovals = num(raw.addedApprovals);
  const removedApprovals = num(raw.removedApprovals);
  const changedNotifications =
    raw.changedNotifications === null || raw.changedNotifications === undefined
      ? null
      : num(raw.changedNotifications);
  const changedQueueStates =
    raw.changedQueueStates === null || raw.changedQueueStates === undefined
      ? null
      : num(raw.changedQueueStates);
  const summaryDelta = typeof raw.summaryDelta === "string" ? raw.summaryDelta : "";
  const handoffVolumeDelta =
    raw.handoffVolumeDelta === null || raw.handoffVolumeDelta === undefined ? null : num(raw.handoffVolumeDelta);
  return {
    addedAutoActions,
    removedAutoActions,
    addedApprovals,
    removedApprovals,
    changedNotifications,
    changedQueueStates,
    summaryDelta,
    handoffVolumeDelta: handoffVolumeDelta ?? null,
  };
}

function riskFlagCount(raw: Record<string, unknown> | null | undefined): number {
  if (!raw || typeof raw !== "object") return 0;
  const rf = raw.riskFlags;
  if (Array.isArray(rf)) return rf.length;
  const lines = raw.lines;
  if (Array.isArray(lines)) return lines.length;
  return 0;
}

function riskLevelFromFlags(n: number): RichScenarioCompareRow["riskLevel"] {
  if (n <= 0) return "low";
  if (n <= 2) return "medium";
  return "high";
}

function recNoteFromScenario(s: BentleyScenarioCompareInput["scenarios"][0]): string {
  if (s.recommendationNote?.trim()) return s.recommendationNote.trim();
  const rj = s.riskSummaryJson;
  if (rj && typeof rj === "object" && "lines" in rj && Array.isArray((rj as { lines: unknown }).lines)) {
    const lines = (rj as { lines: string[] }).lines;
    if (lines[0]?.trim()) return lines[0].trim().slice(0, 200);
  }
  return "—";
}

function computeHighlights(rows: Omit<RichScenarioCompareRow, "highlights">[]): RichScenarioCompareRow[] {
  if (rows.length <= 1) {
    return rows.map((r) => ({
      ...r,
      highlights: Object.fromEntries(
        [
          "addedAutoActions",
          "removedAutoActions",
          "addedApprovals",
          "removedApprovals",
          "changedNotifications",
          "changedQueueStates",
          "handoffVolumeDelta",
        ].map((k) => [k, "neutral" as const])
      ),
    }));
  }

  type CompareMetricKey = keyof Omit<RichScenarioCompareRow, "highlights">;
  const keys: Array<{ key: CompareMetricKey; lowerIsBetter: boolean }> = [
    { key: "addedAutoActions", lowerIsBetter: false },
    { key: "removedAutoActions", lowerIsBetter: false },
    { key: "addedApprovals", lowerIsBetter: true },
    { key: "removedApprovals", lowerIsBetter: false },
    { key: "changedNotifications", lowerIsBetter: true },
    { key: "changedQueueStates", lowerIsBetter: true },
    { key: "handoffVolumeDelta", lowerIsBetter: true },
  ];

  return rows.map((row) => {
    const highlights: Record<string, "best" | "worst" | "neutral"> = {};
    for (const { key, lowerIsBetter } of keys) {
      const vals = rows.map((x) => {
        const v = x[key];
        if (v === null || v === undefined) return null;
        return typeof v === "number" ? v : Number(v);
      });
      const finite = vals.filter((v): v is number => v != null && Number.isFinite(v));
      if (finite.length === 0) {
        highlights[key] = "neutral";
        continue;
      }
      const cur = row[key];
      const n = cur === null || cur === undefined ? null : typeof cur === "number" ? cur : Number(cur);
      if (n == null || !Number.isFinite(n)) {
        highlights[key] = "neutral";
        continue;
      }
      const min = Math.min(...finite);
      const max = Math.max(...finite);
      if (min === max) {
        highlights[key] = "neutral";
        continue;
      }
      const bestVal = lowerIsBetter ? min : max;
      const worstVal = lowerIsBetter ? max : min;
      if (n === bestVal) highlights[key] = "best";
      else if (n === worstVal) highlights[key] = "worst";
      else highlights[key] = "neutral";
    }
    return { ...row, highlights };
  });
}

function metricsForScenario(s: BentleyScenarioCompareInput["scenarios"][0]): BentleyScenarioMetrics {
  const comp = parseComparison(s.comparisonJson ?? undefined);
  const name = s.name?.trim() || s.id;
  const st = (s.scenarioType ?? "").trim() || "unknown";
  const addedAuto = comp?.addedAutoActions ?? 0;
  const removedAuto = comp?.removedAutoActions ?? 0;
  const addedAppr = comp?.addedApprovals ?? 0;
  const reducedAppr = comp?.removedApprovals ?? 0;
  const notifDelta = comp?.changedNotifications;
  const queueDelta = comp?.changedQueueStates;
  const handoffVol = comp?.handoffVolumeDelta ?? null;
  const increasedRisk = riskFlagCount(s.riskSummaryJson ?? undefined);
  const connectorBurdenScore = Math.abs(notifDelta ?? 0) + Math.abs(queueDelta ?? 0);
  const handoffAutomationDelta = addedAuto;

  return {
    id: s.id,
    name,
    scenarioType: st,
    addedAutoActions: addedAuto,
    removedAutoActions: removedAuto,
    addedApprovals: addedAppr,
    reducedApprovals: reducedAppr,
    increasedRiskFlags: increasedRisk,
    notificationDelta: notifDelta ?? null,
    queueHeuristicDelta: queueDelta ?? null,
    handoffVolumeDelta: handoffVol,
    connectorBurdenScore,
    handoffAutomationDelta,
    raw: comp,
  };
}

export type BentleyScenarioCompareResult = {
  rankedScenarios: BentleyScenarioMetrics[];
  safestScenario: BentleyScenarioMetrics | null;
  highestUpsideScenario: BentleyScenarioMetrics | null;
  balancedRecommendation: { scenarioId: string; rationale: string };
  comparisonMatrix: Array<Record<string, string | number | null>>;
  richRows: RichScenarioCompareRow[];
  pairedScenarioMode: boolean;
  recommendationPreset: string | null;
};

export function compareBentleyScenarios(input: BentleyScenarioCompareInput): BentleyScenarioCompareResult {
  const scenarios = input.scenarios?.length ? input.scenarios : [];
  const metrics = scenarios.map(metricsForScenario);
  const paired = Boolean(input.pairedScenarioMode);
  const preset = input.recommendationPreset?.trim() || null;

  const rankedScenarios = [...metrics].sort((a, b) => {
    const score = (m: BentleyScenarioMetrics) =>
      m.addedAutoActions + m.reducedApprovals * 0.5 - m.increasedRiskFlags * 2 - Math.abs(m.notificationDelta ?? 0) * 0.1;
    return score(b) - score(a);
  });

  const safest =
    metrics.length === 0
      ? null
      : [...metrics].sort((a, b) => a.increasedRiskFlags - b.increasedRiskFlags || b.reducedApprovals - a.reducedApprovals)[0] ??
        null;

  const highestUpside =
    metrics.length === 0
      ? null
      : [...metrics].sort((a, b) => b.addedAutoActions + b.reducedApprovals - (a.addedAutoActions + a.reducedApprovals))[0] ??
        null;

  const balanced =
    metrics.length === 0
      ? { scenarioId: "", rationale: "No scenarios to compare." }
      : (() => {
          const mid = rankedScenarios[Math.floor(rankedScenarios.length / 2)] ?? rankedScenarios[0];
          return {
            scenarioId: mid.id,
            rationale: `Balanced pick: ${mid.name} — moderate automation delta (${mid.addedAutoActions} auto actions) with ${mid.increasedRiskFlags} risk flag(s).`,
          };
        })();

  const comparisonMatrix = metrics.map((m) => ({
    id: m.id,
    name: m.name,
    scenarioType: m.scenarioType,
    addedAutoActions: m.addedAutoActions,
    removedAutoActions: m.removedAutoActions,
    addedApprovals: m.addedApprovals,
    reducedApprovals: m.reducedApprovals,
    riskFlags: m.increasedRiskFlags,
    notificationDelta: m.notificationDelta,
    queueDelta: m.queueHeuristicDelta,
    handoffVolumeDelta: m.handoffVolumeDelta,
    connectorBurden: m.connectorBurdenScore,
    handoffAutomationDelta: m.handoffAutomationDelta,
  }));

  const baseRich: Omit<RichScenarioCompareRow, "highlights">[] = metrics.map((m, i) => {
    const s = scenarios[i];
    return {
      id: m.id,
      name: m.name,
      scenarioType: m.scenarioType,
      riskLevel: riskLevelFromFlags(m.increasedRiskFlags),
      addedAutoActions: m.addedAutoActions,
      removedAutoActions: m.removedAutoActions,
      addedApprovals: m.addedApprovals,
      removedApprovals: m.reducedApprovals,
      changedNotifications: m.notificationDelta,
      changedQueueStates: m.queueHeuristicDelta,
      handoffVolumeDelta: m.handoffVolumeDelta,
      recommendationNote: recNoteFromScenario(s),
    };
  });
  const richRows = computeHighlights(baseRich);

  return {
    rankedScenarios,
    safestScenario: safest,
    highestUpsideScenario: highestUpside,
    balancedRecommendation: balanced,
    comparisonMatrix,
    richRows,
    pairedScenarioMode: paired,
    recommendationPreset: preset,
  };
}

export type BentleyScenarioRankInput = {
  scenarios: BentleyScenarioCompareInput["scenarios"];
  /** Prefer lower risk (default true). */
  preferSafety?: boolean;
};

export function rankBentleyScenarios(input: BentleyScenarioRankInput): BentleyScenarioCompareResult {
  return compareBentleyScenarios({ scenarios: input.scenarios });
}
