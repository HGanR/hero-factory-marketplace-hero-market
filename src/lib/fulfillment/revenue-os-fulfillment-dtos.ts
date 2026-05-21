import type { ExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";
import type { FulfillmentPipelineStage } from "@/lib/fulfillment/fulfillment-types";

export type FulfillmentExecutiveApprovalStatus = ExecutiveApprovalStatus | "none";

export type FulfillmentQueueApprovalFilter = FulfillmentExecutiveApprovalStatus;

export function isFulfillmentQueueApprovalFilter(s: string): s is FulfillmentQueueApprovalFilter {
  return ["none", "pending", "approved", "rejected", "executed", "failed", "superseded"].includes(s);
}

export type RevenueOsFulfillmentQueueOrderSummaryDto = {
  id: string;
  clientId: string;
  campaignId: string | null;
  pipelineStage: FulfillmentPipelineStage | string;
  approvalStatus: FulfillmentExecutiveApprovalStatus;
  approvalId: string | null;
  proposedAction: string | null;
  launchReadinessApproved: boolean;
  stalledDays: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RevenueOsFulfillmentQueueListResultDto = {
  ok: true;
  orders: RevenueOsFulfillmentQueueOrderSummaryDto[];
  meta: { limit: number; stageFilter: string | null; approvalFilter: string | null };
};

export type RevenueOsCampaignReviewDto = {
  status: "draft" | "proposed" | "approved" | "revision_requested";
  approvalId: string | null;
  revisionRound: number;
  packetPreview: string | null;
};

export type RevenueOsLaunchReadinessDto = {
  score: number;
  ready: boolean;
  blockers: string[];
  dependencies: string[];
  approvalCheckpointStatus: "none" | "pending" | "approved";
  approvalId: string | null;
};

export type RevenueOsKpiSnapshotDto = {
  campaignStatus: string | null;
  postCounts: { draft: number; scheduled: number; published: number; failed: number };
  kpiHealth: "healthy" | "watch" | "at_risk" | "unknown";
  postLaunchNotes: string[];
};

export type RevenueOsRevisionIntelligenceDto = {
  revisionRound: number;
  pattern: "none" | "single_revision" | "recurring_revisions" | "stalled_after_revision";
  summary: string;
};

export type RevenueOsFulfillmentOrderDetailResultDto = {
  ok: true;
  order: {
    id: string;
    clientId: string;
    campaignId: string | null;
    pipelineStage: string;
    salesSummaryExcerpt: string | null;
    handoff: import("@/lib/fulfillment/revenue-os-fulfillment-handoff").RevenueOsFulfillmentHandoff;
  };
  campaignReview: RevenueOsCampaignReviewDto;
  launchReadiness: RevenueOsLaunchReadinessDto;
  kpiSnapshot: RevenueOsKpiSnapshotDto;
  revisionIntelligence: RevenueOsRevisionIntelligenceDto;
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
