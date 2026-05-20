/** v1 Site Builder slice — WEBSITE service only at the application layer. */
export const FULFILLMENT_PRIMARY_SERVICE_WEBSITE = "WEBSITE" as const;

export const FULFILLMENT_DEPARTMENT_SITE_BUILDER = "site_builder" as const;

export const FULFILLMENT_ARTIFACT_SITE_BUILDER_PACKAGE = "site_builder_package" as const;

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
