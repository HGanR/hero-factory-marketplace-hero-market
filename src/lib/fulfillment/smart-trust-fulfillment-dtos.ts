import type { ExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";
import type { FulfillmentPipelineStage } from "@/lib/fulfillment/fulfillment-types";
import type { ComplianceIntelligenceSummary } from "@/lib/fulfillment/smart-trust-compliance-intelligence";
import type { GovernanceReviewCheckpoint } from "@/lib/fulfillment/smart-trust-review-checkpoints";
import type { ResolutionTrackingSummary } from "@/lib/fulfillment/smart-trust-resolution-tracking";
import type { TrusteeWorkflowAssessment } from "@/lib/fulfillment/smart-trust-governance-workflow";

export type FulfillmentExecutiveApprovalStatus = ExecutiveApprovalStatus | "none";

export type FulfillmentQueueApprovalFilter = FulfillmentExecutiveApprovalStatus;

export function isFulfillmentQueueApprovalFilter(s: string): s is FulfillmentQueueApprovalFilter {
  return ["none", "pending", "approved", "rejected", "executed", "failed", "superseded"].includes(s);
}

export type SmartTrustFulfillmentQueueOrderSummaryDto = {
  id: string;
  clientId: string;
  trustId: string | null;
  pipelineStage: FulfillmentPipelineStage | string;
  approvalStatus: FulfillmentExecutiveApprovalStatus;
  approvalId: string | null;
  proposedAction: string | null;
  governanceReviewApproved: boolean;
  trusteeWorkflowLabel: string;
  stalledDays: number | null;
  createdAt: string;
  updatedAt: string;
};

export type SmartTrustFulfillmentQueueListResultDto = {
  ok: true;
  orders: SmartTrustFulfillmentQueueOrderSummaryDto[];
  meta: { limit: number; stageFilter: string | null; approvalFilter: string | null };
};

export type SmartTrustFulfillmentOrderDetailResultDto = {
  ok: true;
  order: {
    id: string;
    clientId: string;
    trustId: string | null;
    pipelineStage: string;
    salesSummaryExcerpt: string | null;
    handoff: import("@/lib/fulfillment/smart-trust-fulfillment-handoff").SmartTrustFulfillmentHandoff;
  };
  governanceReview: GovernanceReviewCheckpoint;
  trusteeWorkflow: TrusteeWorkflowAssessment;
  resolutionTracking: ResolutionTrackingSummary;
  compliance: ComplianceIntelligenceSummary;
  approvals: Array<{ id: string; proposedAction: string; status: ExecutiveApprovalStatus }>;
  timeline: Array<{ at: string; label: string }>;
  skipperWarnings: string[];
  legalBanner: string;
};

export function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

export function buildSalesSummaryExcerpt(text: string | null | undefined, max = 400): string | null {
  const t = text?.trim();
  if (!t) return null;
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}
