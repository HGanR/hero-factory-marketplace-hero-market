/**
 * Engine-specific batch aggregates (counts by pain, urgency, stage, handoff).
 */

import type { LeadAnalysisRow } from "../queryTypes";
import type { EngineLeadBatchSummary } from "./domainTypes";

function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function computeEngineBatchSummary(rows: LeadAnalysisRow[]): EngineLeadBatchSummary {
  const byPlatform: Record<string, number> = {};
  const byPainType: Record<string, number> = {};
  const byUrgency: Record<string, number> = {};
  const byCommercialStage: Record<string, number> = {};
  const byHandoffReadiness: Record<string, number> = {};

  let sumIntent = 0;
  let sumConf = 0;
  let nIntent = 0;
  let nConf = 0;

  for (const r of rows) {
    bump(byPlatform, r.platform || "unknown");
    if (r.enginePainType) bump(byPainType, r.enginePainType);
    if (r.engineUrgency) bump(byUrgency, r.engineUrgency);
    if (r.engineCommercialStage) bump(byCommercialStage, r.engineCommercialStage);
    bump(byHandoffReadiness, r.handoffReadiness);

    if (typeof r.engineIntentScore0To100 === "number") {
      sumIntent += r.engineIntentScore0To100;
      nIntent++;
    }
    sumConf += r.confidenceScore;
    nConf++;
  }

  return {
    totalLeads: rows.length,
    avgIntentScore0To100: nIntent ? sumIntent / nIntent : 0,
    avgConfidence0To1: nConf ? sumConf / nConf : 0,
    byPlatform,
    byPainType,
    byUrgency,
    byCommercialStage,
    byHandoffReadiness,
  };
}
