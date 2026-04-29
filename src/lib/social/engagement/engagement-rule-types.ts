/**
 * v1 conditions/actions for `social_engagement_rules` (JSON).
 * Processed on ingest; never auto-sends to providers.
 */
export type EngagementRuleConditionsV1 = {
  keywordsAny?: string[];
  intentEquals?: "lead" | "question" | "complaint" | "booking" | "spam" | "praise" | "unclear";
  sentimentEquals?: "positive" | "neutral" | "negative";
  sourceTypeEquals?: "comment" | "dm" | "mention" | "reply" | "ad_comment" | "unknown";
};

export type EngagementRuleActionsV1 = {
  addLabelSlug?: string;
  addLabelDisplayName?: string;
  /** When set, creates an assignment row; use `unassigned` user id for role-only. */
  assignRole?: string;
  /** When true, runs deterministic Bentley triage and stores suggestion (if not already present). */
  attachBentleySuggestion?: boolean;
};
