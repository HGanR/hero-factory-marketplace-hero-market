/**
 * Role-based grouping for generated content (deployment / Bentley operations).
 */

export type RevenueOsContentBatchRole =
  | "attention"
  | "engagement"
  | "authority"
  | "lead_capture"
  | "distribution_support";

export type RevenueOsRoutedContentItem = {
  id?: string;
  source: "content_engine" | "campaign_from_notes" | "launch_mode" | "manual";
  role: RevenueOsContentBatchRole;
  platformHints?: string[];
  confidence: "high" | "medium" | "low";
  title?: string;
  body: string;
  hook?: string | null;
  cta?: string | null;
  reason: string;
};

export type RevenueOsContentBatchRoutingSummary = {
  items: RevenueOsRoutedContentItem[];
  countsByRole: Record<RevenueOsContentBatchRole, number>;
  recommendedPlatformsByRole: Partial<Record<RevenueOsContentBatchRole, string[]>>;
  nextAction: string;
  /** True when platform-role routing informed platformHints. */
  roleHintsFromPlatformRouting: boolean;
};

export const ALL_CONTENT_BATCH_ROLES: RevenueOsContentBatchRole[] = [
  "attention",
  "engagement",
  "authority",
  "lead_capture",
  "distribution_support",
];

export function emptyCountsByRole(): Record<RevenueOsContentBatchRole, number> {
  return {
    attention: 0,
    engagement: 0,
    authority: 0,
    lead_capture: 0,
    distribution_support: 0,
  };
}
