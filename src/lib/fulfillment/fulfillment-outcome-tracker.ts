import type {
  FulfillmentOutcomeKind,
  FulfillmentOutcomeRecord,
  OperationalMemoryOrderRecord,
} from "@/lib/fulfillment/fulfillment-operational-memory-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

const STALL_DAYS = 7;

export function trackFulfillmentOutcomes(
  orders: OperationalMemoryOrderRecord[],
  revisionEventCounts: Map<string, number>
): FulfillmentOutcomeRecord[] {
  const out: FulfillmentOutcomeRecord[] = [];

  for (const o of orders) {
    const revisionCount = revisionEventCounts.get(o.orderId) ?? Math.max(0, o.draftVersion - 1);
    let outcome: FulfillmentOutcomeKind = "progressing";
    let summary = `${o.department} progressing in ${o.pipelineStage}`;

    if (
      o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS &&
      o.approvalStatus === "pending"
    ) {
      outcome = "revenue_os_launch_blocked";
      summary = "REVENUE_OS blocked on campaign review or launch readiness approval";
    } else if (o.approvalStatus === "pending") {
      outcome = "approval_blocked";
      summary = `${o.department} blocked on executive approval`;
    } else if (
      o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST &&
      (o.pipelineStage === "owner_review" || o.ownerReviewStatus === "pending") &&
      o.daysInCurrentStage >= STALL_DAYS
    ) {
      outcome = "trust_packet_stalled";
      summary = `TRUST packet stalled in owner review (${o.daysInCurrentStage}d)`;
    } else if (
      o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE &&
      o.clientDeliveryStatus === "client_approved" &&
      revisionCount <= 1
    ) {
      outcome = "website_draft_low_revision";
      summary = "WEBSITE draft reached client approval with minimal revisions";
    } else if (o.clientDeliveryStatus === "client_revision_requested" || revisionCount >= 2) {
      outcome = "revision_heavy";
      summary = `${o.department} revision-heavy (${revisionCount} revision cycle(s))`;
    } else if (o.clientDeliveryStatus === "client_approved") {
      outcome = "client_approved";
      summary = `${o.department} client approved deliverable`;
    } else if (
      o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS &&
      o.daysInCurrentStage >= STALL_DAYS &&
      o.pipelineStage !== "released"
    ) {
      outcome = "revenue_os_campaign_stalled";
      summary = `REVENUE_OS campaign fulfillment stalled (${o.daysInCurrentStage}d in ${o.pipelineStage})`;
    } else if (
      o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS &&
      (revisionCount >= 2 || o.clientDeliveryStatus === "client_revision_requested")
    ) {
      outcome = "revenue_os_kpi_watch";
      summary = "REVENUE_OS revision-heavy — review KPI and creative before launch checkpoint";
    } else if (o.ownerReviewStatus === "pending" && o.daysInCurrentStage >= STALL_DAYS) {
      outcome = "owner_review_stalled";
      summary = `${o.department} owner review stalled (${o.daysInCurrentStage}d)`;
    }

    out.push({
      orderId: o.orderId,
      clientId: o.clientId,
      department: o.department,
      outcome,
      revisionCount,
      daysInStage: o.daysInCurrentStage,
      summary,
    });
  }

  return out;
}

export function countOutcomesByKind(outcomes: FulfillmentOutcomeRecord[]): Record<FulfillmentOutcomeKind, number> {
  const counts = {} as Record<FulfillmentOutcomeKind, number>;
  for (const o of outcomes) {
    counts[o.outcome] = (counts[o.outcome] ?? 0) + 1;
  }
  return counts;
}
