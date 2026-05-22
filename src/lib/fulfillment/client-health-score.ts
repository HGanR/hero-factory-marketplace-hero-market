import type {
  ClientFulfillmentOrderSnapshot,
  ClientHealthScore,
  ClientHealthTier,
  DepartmentReadinessSnapshot,
  SharedClientReadinessSummary,
} from "@/lib/fulfillment/fulfillment-orchestration-types";
import { loadTrustIntakeFromOrder } from "@/lib/fulfillment/trust-intake-summary";
import { loadWebsiteIntakeFromOrder } from "@/lib/fulfillment/website-intake-summary";
import { loadRevenueOsIntakeFromOrder } from "@/lib/fulfillment/revenue-os-intake-readiness";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

const STALL_DAYS_THRESHOLD = 7;

export function computeDaysInStage(updatedAt: Date | string | null, createdAt: Date | string): number {
  const ref = updatedAt ?? createdAt;
  const ms = Date.now() - new Date(ref).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function detectClientStallReasons(orders: ClientFulfillmentOrderSnapshot[]): string[] {
  const reasons: string[] = [];
  for (const o of orders) {
    if (o.pipelineStage === "released" || o.pipelineStage === "closed") continue;
    if (o.approvalStatus === "pending") {
      reasons.push(`${o.department}: pending executive approval on order ${o.orderId.slice(0, 8)}…`);
    }
    if (o.daysInCurrentStage >= STALL_DAYS_THRESHOLD) {
      reasons.push(
        `${o.department}: in stage "${o.pipelineStage}" for ${o.daysInCurrentStage}d without progression`
      );
    }
    if (o.pipelineStage === "owner_review" && o.ownerReviewStatus === "pending") {
      reasons.push(`${o.department}: owner review pending on deliverable`);
    }
    if (
      o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS &&
      !o.launchReadinessApproved &&
      o.pipelineStage === "approved_for_release"
    ) {
      reasons.push(`${o.department}: launch readiness checkpoint not recorded — Bentley launch still gated`);
    }
    if (o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS && !o.campaignId) {
      reasons.push(`${o.department}: campaign not linked on fulfillment handoff`);
    }
    if (!o.paymentConsumed && o.paymentStatus !== "confirmed" && o.pipelineStage === "executive_handoff_received") {
      reasons.push(`${o.department}: payment not confirmed — handoff blocked`);
    }
  }
  return [...new Set(reasons)];
}

export function buildSharedClientReadinessSummary(input: {
  clientId: string;
  orders: Array<{
    primaryService: string;
    executiveHandoffJson: string | null;
    salesSummaryText: string | null;
    requestedDeliverableJson: string | null;
    pipelineStage?: string;
  }>;
}): SharedClientReadinessSummary {
  const departments: DepartmentReadinessSnapshot[] = [];

  const webOrder = input.orders.find((o) => o.primaryService === FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
  if (webOrder) {
    const pkg = loadWebsiteIntakeFromOrder({
      executiveHandoffJson: webOrder.executiveHandoffJson,
      salesSummaryText: webOrder.salesSummaryText,
      requestedDeliverableJson: webOrder.requestedDeliverableJson,
    });
    departments.push({
      department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      tier: pkg.readiness.tier,
      score: pkg.readiness.score,
      fulfillmentReady: pkg.readiness.fulfillmentReady,
      summaryExcerpt: pkg.skipperSummary.slice(0, 400),
    });
  }

  const trustOrder = input.orders.find((o) => o.primaryService === FULFILLMENT_PRIMARY_SERVICE_TRUST);
  const revenueOrder = input.orders.find((o) => o.primaryService === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);
  if (trustOrder) {
    const pkg = loadTrustIntakeFromOrder({
      executiveHandoffJson: trustOrder.executiveHandoffJson,
      salesSummaryText: trustOrder.salesSummaryText,
      requestedDeliverableJson: trustOrder.requestedDeliverableJson,
    });
    departments.push({
      department: FULFILLMENT_PRIMARY_SERVICE_TRUST,
      tier: pkg.readiness.tier,
      score: pkg.readiness.score,
      fulfillmentReady: pkg.readiness.fulfillmentReady,
      summaryExcerpt: pkg.skipperSummary.slice(0, 400),
    });
  }

  if (revenueOrder) {
    const pkg = loadRevenueOsIntakeFromOrder({
      executiveHandoffJson: revenueOrder.executiveHandoffJson,
      salesSummaryText: revenueOrder.salesSummaryText,
      pipelineStage: revenueOrder.pipelineStage ?? "executive_handoff_received",
    });
    departments.push({
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      tier: pkg.readiness.tier === "ready" ? "ready" : pkg.readiness.tier === "blocked" ? "blocked" : "partial",
      score: pkg.readiness.score,
      fulfillmentReady: pkg.readiness.fulfillmentReady,
      summaryExcerpt: pkg.skipperSummary.slice(0, 400),
    });
  }

  const overallFulfillmentReady =
    departments.length > 0 && departments.every((d) => d.fulfillmentReady);

  let weakest: FulfillmentOrchestrationDepartment | null = null;
  if (departments.length) {
    const sorted = [...departments].sort((a, b) => a.score - b.score);
    weakest = sorted[0]!.department;
  }

  const narrativeParts = [
    departments.length
      ? `Readiness captured for ${departments.map((d) => d.department).join(" + ")}.`
      : "No fulfillment intake on file — readiness unknown until handoff.",
    overallFulfillmentReady
      ? "Client is fulfillment-ready across active departments."
      : weakest
        ? `${weakest} intake is the weakest link — desk may need more intake before drafting.`
        : "Fulfillment readiness incomplete.",
  ];

  return {
    clientId: input.clientId,
    departments,
    overallFulfillmentReady,
    weakestDepartment: weakest,
    narrative: narrativeParts.join(" "),
  };
}

function tierFromScore(score: number): ClientHealthTier {
  if (score >= 80) return "healthy";
  if (score >= 60) return "steady";
  if (score >= 40) return "at_risk";
  return "critical";
}

export function computeClientHealthScore(input: {
  clientId: string;
  orders: ClientFulfillmentOrderSnapshot[];
  readiness: SharedClientReadinessSummary;
}): ClientHealthScore {
  let score = 72;
  const factors: ClientHealthScore["factors"] = [];
  const stallReasons = detectClientStallReasons(input.orders);

  if (!input.orders.length) {
    return {
      clientId: input.clientId,
      score: 50,
      tier: "steady",
      stalled: false,
      stallReasons: [],
      factors: [{ key: "no_orders", label: "No fulfillment orders", impact: -10, detail: "Desk idle for fulfillment" }],
    };
  }

  if (input.readiness.overallFulfillmentReady) {
    score += 8;
    factors.push({
      key: "readiness",
      label: "Intake readiness",
      impact: 8,
      detail: "All active departments fulfillment-ready",
    });
  } else if (input.readiness.weakestDepartment) {
    score -= 12;
    factors.push({
      key: "readiness",
      label: "Intake readiness gap",
      impact: -12,
      detail: `Weakest: ${input.readiness.weakestDepartment}`,
    });
  }

  const pendingApprovals = input.orders.filter((o) => o.approvalStatus === "pending").length;
  if (pendingApprovals) {
    score -= pendingApprovals * 8;
    factors.push({
      key: "approvals",
      label: "Pending approvals",
      impact: -pendingApprovals * 8,
      detail: `${pendingApprovals} approval(s) blocking progress`,
    });
  }

  const ownerReviewPending = input.orders.filter(
    (o) => o.pipelineStage === "owner_review" && o.ownerReviewStatus === "pending"
  ).length;
  if (ownerReviewPending) {
    score -= ownerReviewPending * 5;
    factors.push({
      key: "owner_review",
      label: "Owner review queue",
      impact: -ownerReviewPending * 5,
      detail: `${ownerReviewPending} deliverable(s) awaiting owner review`,
    });
  }

  const progressed = input.orders.filter(
    (o) =>
      o.pipelineStage === "approved_for_release" ||
      o.pipelineStage === "released" ||
      o.ownerReviewStatus === "approved"
  ).length;
  if (progressed) {
    score += progressed * 6;
    factors.push({
      key: "progress",
      label: "Approved deliverables",
      impact: progressed * 6,
      detail: `${progressed} order(s) reached internal approval milestones`,
    });
  }

  const stalled = stallReasons.length > 0;
  if (stalled) score -= 15;

  score = Math.min(100, Math.max(0, Math.round(score)));

  return {
    clientId: input.clientId,
    score,
    tier: tierFromScore(score),
    stalled,
    stallReasons,
    factors,
  };
}
