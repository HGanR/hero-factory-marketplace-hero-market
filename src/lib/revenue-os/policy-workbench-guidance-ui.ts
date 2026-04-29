/**
 * Pure helpers for rendering workbench scenario guidance lines from `GrowthGuidance` (no DB).
 */

import type { GrowthGuidance } from "@/lib/revenue-os/market-sweep-schema";

export type WorkbenchScenarioGuidanceLine = {
  key: "compare" | "preset" | "apply";
  label: string;
  text: string;
};

export function workbenchScenarioGuidanceLinesForUi(gg: GrowthGuidance | null | undefined): WorkbenchScenarioGuidanceLine[] {
  if (!gg) return [];
  const out: WorkbenchScenarioGuidanceLine[] = [];
  const c = gg.bentleyScenarioCompareSummaryLine?.trim();
  if (c) out.push({ key: "compare", label: "Compare", text: c });
  const p = gg.bentleyScenarioPresetRecommendationLine?.trim();
  if (p) out.push({ key: "preset", label: "Presets", text: p });
  const a = gg.bentleyApplyReviewSummaryLine?.trim();
  if (a) out.push({ key: "apply", label: "Apply review", text: a });
  return out;
}

export function hasWorkbenchScenarioGuidanceSummaryLines(gg: GrowthGuidance | null | undefined): boolean {
  return workbenchScenarioGuidanceLinesForUi(gg).length > 0;
}
