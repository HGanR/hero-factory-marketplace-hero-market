export type OmnibarBuilderStage = "describe" | "review" | "refine" | "publish";

export type OmnibarSubmitRoute =
  | "publish_skip"
  | "refine_sections"
  | "refine_light_page"
  | "refine_heavy_page"
  | "review_full_build"
  | "review_plan_first"
  | "describe_plan";

/**
 * Pure routing for omnibar primary submit (no side effects).
 */
export function resolveOmnibarSubmitRoute(args: {
  stage: OmnibarBuilderStage;
  selectedSectionCount: number;
  hasPlanner: boolean;
  /** Home page blocks with both aiSectionId and aiRegistryKey — required for light refinement. */
  refinableHomeSectionCount: number;
}): OmnibarSubmitRoute {
  if (args.stage === "publish") return "publish_skip";
  if (args.stage === "refine" && args.selectedSectionCount > 0) return "refine_sections";
  if (args.stage === "refine") {
    if (args.refinableHomeSectionCount > 0) return "refine_light_page";
    return "refine_heavy_page";
  }
  if (args.stage === "review") {
    if (!args.hasPlanner) return "review_plan_first";
    return "review_full_build";
  }
  return "describe_plan";
}
