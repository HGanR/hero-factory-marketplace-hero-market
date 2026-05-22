/** WEBSITE fulfillment slice. */
export const FULFILLMENT_PRIMARY_SERVICE_WEBSITE = "WEBSITE" as const;

/** TRUST / Trust Records + Smart Trust fulfillment slice (Slice 1). */
export const FULFILLMENT_PRIMARY_SERVICE_TRUST = "TRUST" as const;

/** AI Revenue OS campaign fulfillment — governed orchestration only (no autonomous launch). */
export const FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS = "REVENUE_OS" as const;

/** Smart Trust governance operations — advisory checkpoints only (no legal automation). */
export const FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST = "SMART_TRUST" as const;

export const FULFILLMENT_DEPARTMENT_SITE_BUILDER = "site_builder" as const;

export const FULFILLMENT_DEPARTMENT_TRUST_RECORDS = "trust_records" as const;

export const FULFILLMENT_DEPARTMENT_AI_REVENUE_OS = "ai_revenue_os" as const;

export const FULFILLMENT_DEPARTMENT_SMART_TRUST = "smart_trust" as const;

export const FULFILLMENT_ARTIFACT_SITE_BUILDER_PACKAGE = "site_builder_package" as const;

export const FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET = "trust_review_packet" as const;

export const FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF = "smart_trust_setup_brief" as const;

export const FULFILLMENT_ARTIFACT_CAMPAIGN_REVIEW_PACKET = "campaign_review_packet" as const;

export const FULFILLMENT_ARTIFACT_LAUNCH_READINESS_BRIEF = "launch_readiness_brief" as const;

export const FULFILLMENT_ARTIFACT_GOVERNANCE_REVIEW_PACKET = "governance_review_packet" as const;

export const FULFILLMENT_ARTIFACT_TRUST_RESOLUTION_RECORD = "trust_resolution_record" as const;

export const FULFILLMENT_ARTIFACT_TRUST_AMENDMENT_REVIEW_BRIEF = "trust_amendment_review_brief" as const;

export const FULFILLMENT_REVENUE_OS_ARTIFACT_TYPES = [
  FULFILLMENT_ARTIFACT_CAMPAIGN_REVIEW_PACKET,
  FULFILLMENT_ARTIFACT_LAUNCH_READINESS_BRIEF,
] as const;

export type FulfillmentRevenueOsArtifactType = (typeof FULFILLMENT_REVENUE_OS_ARTIFACT_TYPES)[number];

export const FULFILLMENT_SMART_TRUST_ARTIFACT_TYPES = [
  FULFILLMENT_ARTIFACT_GOVERNANCE_REVIEW_PACKET,
  FULFILLMENT_ARTIFACT_TRUST_RESOLUTION_RECORD,
  FULFILLMENT_ARTIFACT_TRUST_AMENDMENT_REVIEW_BRIEF,
] as const;

export type FulfillmentSmartTrustArtifactType = (typeof FULFILLMENT_SMART_TRUST_ARTIFACT_TYPES)[number];

export const FULFILLMENT_TRUST_ARTIFACT_TYPES = [
  FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET,
  FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF,
] as const;

export type FulfillmentTrustArtifactType = (typeof FULFILLMENT_TRUST_ARTIFACT_TYPES)[number];

export const FULFILLMENT_ORDER_SOURCE_CLAUDE_WORKER = "claude_worker" as const;

/** Manual PayPal reconciliation — no PayPal API/webhook in v1. */
export const PAYMENT_PROVIDER_ADMIN_MANUAL = "admin_manual" as const;

export const FULFILLMENT_PIPELINE_STAGES = [
  "executive_handoff_received",
  "fulfillment_queued",
  "service_drafting",
  "owner_review",
  "approved_for_release",
  "released",
  "closed",
] as const;

export type FulfillmentPipelineStage = (typeof FULFILLMENT_PIPELINE_STAGES)[number];

export const FULFILLMENT_INITIAL_STAGE: FulfillmentPipelineStage = "executive_handoff_received";
