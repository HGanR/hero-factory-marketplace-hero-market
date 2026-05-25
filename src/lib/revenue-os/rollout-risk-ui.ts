/**
 * UI cards for rollout risk / rollback triggers (operator dashboard).
 */

import type { BentleyRolloutCoachingResult } from "@/lib/revenue-os/rollout-coaching";

export function buildRolloutRiskSummaryCards(coaching: BentleyRolloutCoachingResult) {
  return [
    {
      id: "risk_level",
      title: "Rollout risk",
      detail: `${coaching.riskAssessment.level} — ${coaching.riskAssessment.rationale}`.slice(0, 400),
    },
    {
      id: "operator_warnings",
      title: "Operator warnings",
      detail: coaching.operatorWarnings.slice(0, 3).join(" · ").slice(0, 400),
    },
  ];
}

export function buildRollbackTriggerList(coaching: BentleyRolloutCoachingResult): string[] {
  return [...coaching.rollbackTriggers];
}
