/**
 * Consultant plan + campaign brief synthesis — same POST as `AiRevenueOsPipeline` synthesis effect.
 * @see BENTLEY_ACTION_MAP
 */
export {
  runSynthesizePlanApi as runSynthesizePlan,
  researchResultToSnippet,
  buildSynthesisInputSignature,
} from "./revenue-os-pipeline-actions";
export type { SynthesizePlanResult, ResearchSnippet } from "./revenue-os-pipeline-actions";
