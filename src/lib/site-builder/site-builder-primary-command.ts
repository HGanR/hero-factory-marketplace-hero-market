export type SiteBuilderPrimaryCommandScope = "selected_sections" | "full_page" | "not_applicable";

/**
 * Pure helper: what the unified primary command should do in Refine.
 */
export function resolveRefinePrimaryCommandScope(selectedSectionCount: number): SiteBuilderPrimaryCommandScope {
  if (selectedSectionCount > 0) return "selected_sections";
  return "full_page";
}

export function isRefineStage(stage: string): boolean {
  return stage === "refine";
}
