/**
 * Bentley guided assistant — field keys aligned with AI Revenue OS page state.
 * See bentley-orchestrator.ts for question order, phases, and parsing.
 */

export type BentleyFieldKey =
  | "industryKey"
  | "targetAudience"
  | "traffic"
  | "conversionRate"
  | "aov"
  | "businessName"
  | "coreOffer"
  | "transformation"
  | "postingPlatforms"
  | "platforms"
  | "tone"
  | "contentType"
  | "imageStyle"
  | "campaignNotes";

/** Section anchors / data-bentley-section values for scroll focus */
export type BentleySectionId =
  | "industry-intelligence"
  | "research-assistant"
  | "trends-library"
  | "content-engine"
  | "campaign-from-notes"
  /** Revenue OS Dashboard — Launch Campaigns (Section 1 · Video) */
  | "launch-campaigns"
  /** Revenue OS Dashboard — Module 3 Deployment Center */
  | "deployment-center";

/** High-level workflow phases (governor) */
export type BentleyWorkflowPhase =
  | "intake"
  | "revenue_model"
  | "content_setup"
  | "campaign_prep"
  | "ready";

/** Checklist strip (5 visible milestones) */
export type BentleyChecklistId =
  | "intake"
  | "revenue_inputs"
  | "content_profile"
  | "campaign_notes"
  | "ready_to_run";
