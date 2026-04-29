/**
 * Shared Trends Library fetch — same POST as `TrendsLibrarySection` “Identify Trending Content”.
 * (Optional bundle generation uses `/api/trends/generate` — not part of this export.)
 * @see BENTLEY_ACTION_MAP
 */
export { runTrendsApi as runTrends } from "./revenue-os-pipeline-actions";
export type { TrendsApiParams } from "./revenue-os-pipeline-actions";
