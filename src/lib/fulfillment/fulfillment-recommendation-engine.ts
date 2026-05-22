import { randomUUID } from "crypto";
import { resolveCrossDepartmentDependencyNarrative } from "@/lib/fulfillment/department-dependency-map";
import type { RecommendationMemoryWeights } from "@/lib/fulfillment/fulfillment-operational-memory-types";
import { applyMemoryWeightsToRecommendations } from "@/lib/fulfillment/recommendation-feedback";
import type {
  ClientFulfillmentOrderSnapshot,
  ClientHealthScore,
  ClientOperationsGraph,
  CrossSellOpportunity,
  FulfillmentRecommendation,
  FulfillmentSequencingRecommendation,
  OperationalBottleneck,
  SharedClientReadinessSummary,
} from "@/lib/fulfillment/fulfillment-orchestration-types";
import {
  buildRevenueOsOrchestrationSignals,
  rankRevenueOsRecommendationPriority,
} from "@/lib/fulfillment/revenue-os-orchestration-signals";
import {
  buildSmartTrustOrchestrationSignals,
  rankSmartTrustRecommendationPriority,
} from "@/lib/fulfillment/smart-trust-orchestration-signals";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

export type RecommendationEngineInput = {
  clientId: string;
  orders: ClientFulfillmentOrderSnapshot[];
  graph: ClientOperationsGraph;
  readiness: SharedClientReadinessSummary;
  health: ClientHealthScore;
  campaignCount: number;
  websiteApprovedForRelease: boolean;
  /** When true, campaign KPI signals suggest watch/at_risk (read-only). */
  revenueOsKpiAtRisk?: boolean;
  /** Read-only operational memory weights — reorders recommendations only. */
  memoryWeights?: RecommendationMemoryWeights;
};

function findOrder(
  orders: ClientFulfillmentOrderSnapshot[],
  dept: FulfillmentOrchestrationDepartment
) {
  return orders.find((o) => o.department === dept) ?? null;
}

function buildRevenueOsCampaignRecommendations(
  order: ClientFulfillmentOrderSnapshot,
  input: RecommendationEngineInput
): FulfillmentRecommendation[] {
  const recs: FulfillmentRecommendation[] = [];
  if (order.department !== FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS) return recs;

  const signals = buildRevenueOsOrchestrationSignals(order, null, {
    websiteOrderReleased: input.websiteApprovedForRelease,
  });
  if (!signals) return recs;

  const priority = rankRevenueOsRecommendationPriority({
    hasLaunchBlockers: signals.launchBlockers.length > 0,
    pendingApproval: signals.pendingRevenueOsApproval,
    kpiAtRisk: Boolean(input.revenueOsKpiAtRisk),
    stalled: signals.stalledCampaignFulfillment,
  });

  if (!signals.campaignId) {
    recs.push({
      id: randomUUID(),
      kind: "resolve_bottleneck",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      priority: "high",
      title: "Link campaign to REVENUE_OS fulfillment order",
      rationale:
        "Campaign fulfillment intake requires campaignId on order handoff — no autonomous campaign creation.",
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if (
    order.pipelineStage === "executive_handoff_received" &&
    order.paymentConsumed &&
    order.approvalStatus === "none" &&
    signals.campaignId
  ) {
    recs.push({
      id: randomUUID(),
      kind: "engage_department",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      priority,
      title: "Propose REVENUE_OS campaign review packet",
      rationale:
        "Campaign linked — queue createRevenueOsCampaignReviewPacket approval (internal note only; no publish or Content360 execution).",
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if (
    signals.campaignId &&
    !signals.launchReadinessApproved &&
    (order.ownerReviewStatus === "approved" || order.pipelineStage === "service_drafting")
  ) {
    recs.push({
      id: randomUUID(),
      kind: "engage_department",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      priority,
      title: "Propose REVENUE_OS launch readiness checkpoint",
      rationale:
        "After campaign review — owner must approve launch readiness checkpoint. Does not run sync-launch or ad spend.",
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if (signals.launchBlockers.length > 0) {
    recs.push({
      id: randomUUID(),
      kind: "resolve_bottleneck",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      priority: "high",
      title: "Resolve REVENUE_OS launch blockers",
      rationale: signals.launchBlockers.slice(0, 4).join("; "),
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if ((order.revisionRound ?? 0) >= 2) {
    recs.push({
      id: randomUUID(),
      kind: "monitor_only",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      priority: "normal",
      title: "Review recurring REVENUE_OS campaign revisions",
      rationale: `Revision round ${order.revisionRound ?? 0} — align creative before launch checkpoint; no autonomous relaunch.`,
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if (input.revenueOsKpiAtRisk) {
    recs.push({
      id: randomUUID(),
      kind: "monitor_only",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      priority: "normal",
      title: "Monitor REVENUE_OS KPI health",
      rationale:
        "Post/campaign KPI signals are at risk — triage failed posts and confirm no autonomous publish retry.",
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  return recs;
}

function buildSmartTrustGovernanceRecommendations(
  order: ClientFulfillmentOrderSnapshot
): FulfillmentRecommendation[] {
  const recs: FulfillmentRecommendation[] = [];
  if (order.department !== FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST) return recs;

  const signals = buildSmartTrustOrchestrationSignals(order, null);
  if (!signals) return recs;

  const priority = rankSmartTrustRecommendationPriority({
    hasGovernanceBlockers: signals.governanceBlockers.length > 0,
    pendingApproval: signals.pendingSmartTrustApproval,
    complianceUrgent: signals.openResolutionCount > 0 && !signals.governanceReviewApproved,
    stalled: signals.stalledGovernanceFulfillment,
  });

  if (!signals.trustId) {
    recs.push({
      id: randomUUID(),
      kind: "resolve_bottleneck",
      department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
      priority: "high",
      title: "Link trust workspace to SMART_TRUST order",
      rationale: "Governance desk requires trustId on order handoff — no autonomous trust creation.",
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if (
    signals.trustId &&
    !signals.governanceReviewApproved &&
    order.approvalStatus === "none" &&
    order.paymentConsumed
  ) {
    recs.push({
      id: randomUUID(),
      kind: "engage_department",
      department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
      priority,
      title: "Propose Smart Trust governance review",
      rationale:
        "Queue createSmartTrustGovernanceReviewPacket — internal governance note only; no trust execution or amendment application.",
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if (signals.governanceBlockers.length > 0) {
    recs.push({
      id: randomUUID(),
      kind: "resolve_bottleneck",
      department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
      priority: "high",
      title: "Resolve Smart Trust governance blockers",
      rationale: signals.governanceBlockers.slice(0, 4).join("; "),
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if (signals.openResolutionCount > 0 || order.pipelineStage === "owner_review") {
    recs.push({
      id: randomUUID(),
      kind: "engage_department",
      department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
      priority,
      title: "Record resolution / minutes checkpoint",
      rationale:
        "Governed resolution record via recordSmartTrustResolutionCheckpoint — minutes tracking only; no filing or signatures.",
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  if ((order.governanceReviewRound ?? 0) >= 2) {
    recs.push({
      id: randomUUID(),
      kind: "monitor_only",
      department: FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
      priority: "normal",
      title: "Review amendment / governance revision history",
      rationale: `Governance round ${order.governanceReviewRound ?? 0} — human counsel review before further checkpoints.`,
      requiresHumanAction: true,
      relatedOrderIds: [order.orderId],
    });
  }

  return recs;
}

export function buildFulfillmentSequencingRecommendation(
  orders: ClientFulfillmentOrderSnapshot[]
): FulfillmentSequencingRecommendation {
  const web = findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
  const trust = findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_TRUST);
  const revenue = findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);
  const blockedBy: FulfillmentOrchestrationDepartment[] = [];

  if (!orders.length) {
    return {
      recommendedOrder: [],
      rationale: "No active fulfillment orders — confirm payment and intake before sequencing departments.",
      blockedBy: [],
    };
  }

  if (trust && !web) {
    return {
      recommendedOrder: [FULFILLMENT_PRIMARY_SERVICE_TRUST],
      rationale:
        "TRUST-only client — complete legal-review packet flow first. WEBSITE is optional and not required.",
      blockedBy: [],
    };
  }

  if (revenue && !web && !trust) {
    return {
      recommendedOrder: [FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS],
      rationale:
        "REVENUE_OS-only — complete campaign review packet and launch readiness checkpoint before any Bentley launch approval.",
      blockedBy: [],
    };
  }

  if (web && !trust && !revenue) {
    return {
      recommendedOrder: [FULFILLMENT_PRIMARY_SERVICE_WEBSITE],
      rationale: "WEBSITE-only client — proceed with Site Builder drafting and owner review.",
      blockedBy: [],
    };
  }

  const trustStage = trust?.pipelineStage ?? null;
  const webStage = web?.pipelineStage ?? null;
  const webEarly =
    webStage === "executive_handoff_received" ||
    webStage === "fulfillment_queued" ||
    webStage === "service_drafting";
  const trustReview =
    trustStage === "owner_review" ||
    trustStage === "approved_for_release" ||
    trustStage === "released";

  if (webEarly && trustReview) {
    return {
      recommendedOrder: [FULFILLMENT_PRIMARY_SERVICE_TRUST, FULFILLMENT_PRIMARY_SERVICE_WEBSITE],
      rationale:
        "TRUST owner review is ahead — finish TRUST packet approval, then align WEBSITE copy/disclaimers (recommendation only).",
      blockedBy: [],
    };
  }

  if (web && trust && web.approvalStatus === "pending") {
    blockedBy.push(FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
  }
  if (web && trust && trust.approvalStatus === "pending") {
    blockedBy.push(FULFILLMENT_PRIMARY_SERVICE_TRUST);
  }
  if (revenue && revenue.approvalStatus === "pending") {
    blockedBy.push(FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);
  }

  const recommendedOrder: FulfillmentOrchestrationDepartment[] = [
    FULFILLMENT_PRIMARY_SERVICE_TRUST,
    FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
  ];
  if (revenue) recommendedOrder.push(FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);

  return {
    recommendedOrder,
    rationale:
      "Parallel desk work allowed — TRUST → WEBSITE → REVENUE_OS is a common owner sequence; launch still requires separate Bentley approvals (no autonomous spend).",
    blockedBy,
  };
}

export function detectCrossSellOpportunities(input: RecommendationEngineInput): CrossSellOpportunity[] {
  const ops: CrossSellOpportunity[] = [];
  const web = findOrder(input.orders, FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
  const trust = findOrder(input.orders, FULFILLMENT_PRIMARY_SERVICE_TRUST);
  const revenue = findOrder(input.orders, FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);

  if (web && !trust) {
    ops.push({
      id: randomUUID(),
      target: FULFILLMENT_PRIMARY_SERVICE_TRUST,
      title: "Consider TRUST legal-review intake",
      rationale:
        "Client has WEBSITE fulfillment active without TRUST — if entity/trust planning was discussed in sales, queue TRUST handoff after separate payment confirmation (advisory only).",
      confidence: "low",
      advisoryOnly: true,
    });
  }

  if (trust && !web) {
    ops.push({
      id: randomUUID(),
      target: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      title: "Consider WEBSITE after counsel review",
      rationale:
        "TRUST packet may precede a public-facing site — recommend WEBSITE only after attorney review path is clear (advisory only).",
      confidence: "medium",
      advisoryOnly: true,
    });
  }

  if (input.websiteApprovedForRelease && input.campaignCount === 0 && !revenue) {
    ops.push({
      id: randomUUID(),
      target: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      title: "Consider REVENUE_OS campaign fulfillment intake",
      rationale:
        "WEBSITE approved for release and no governed REVENUE_OS order — executive desk may open campaign fulfillment (no worker handoff).",
      confidence: "medium",
      advisoryOnly: true,
    });
  }

  if (revenue && !web) {
    ops.push({
      id: randomUUID(),
      target: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      title: "Consider WEBSITE for campaign landing",
      rationale:
        "REVENUE_OS active without WEBSITE — landing pages may need Site Builder release before launch readiness (advisory only).",
      confidence: "high",
      advisoryOnly: true,
    });
  }

  if (input.campaignCount > 0 && web && web.pipelineStage !== "approved_for_release" && web.pipelineStage !== "released") {
    ops.push({
      id: randomUUID(),
      target: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      title: "Align WEBSITE before scaling campaigns",
      rationale:
        "Campaigns exist while WEBSITE is not approved for release — landing experience may be misaligned (monitor only).",
      confidence: "high",
      advisoryOnly: true,
    });
  }

  return ops;
}

export function buildFulfillmentRecommendations(input: RecommendationEngineInput): FulfillmentRecommendation[] {
  const recs: FulfillmentRecommendation[] = [];
  const { orders, health, readiness } = input;

  for (const order of orders) {
    if (order.paymentStatus !== "confirmed") {
      recs.push({
        id: randomUUID(),
        kind: "payment_gate",
        department: order.department,
        priority: "high",
        title: `Confirm payment for ${order.department}`,
        rationale: "Manual PayPal reconciliation must complete before Claude handoff or drafting continues.",
        requiresHumanAction: true,
        relatedOrderIds: [order.orderId],
      });
    }

    if (order.approvalStatus === "pending") {
      recs.push({
        id: randomUUID(),
        kind: "approval_review",
        department: order.department,
        priority: "high",
        title: `Review pending ${order.department} executive approval`,
        rationale: "Approval queue item is blocking fulfillment progression — no auto-execution.",
        requiresHumanAction: true,
        relatedOrderIds: [order.orderId],
      });
    }

    if (order.pipelineStage === "owner_review" && order.ownerReviewStatus === "pending") {
      recs.push({
        id: randomUUID(),
        kind: "engage_department",
        department: order.department,
        priority: "normal",
        title: `Owner review ${order.department} deliverable`,
        rationale:
          order.department === FULFILLMENT_PRIMARY_SERVICE_TRUST
            ? "Review trust legal-review packet internally — no trust apply or client delivery."
            : order.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS
              ? "Review campaign review packet — launch requires separate readiness checkpoint and Bentley approval."
              : "Review Site Builder draft internally — no deploy or client send from this recommendation.",
        requiresHumanAction: true,
        relatedOrderIds: [order.orderId],
      });
    }

    if (order.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS) {
      recs.push(...buildRevenueOsCampaignRecommendations(order, input));
      continue;
    }

    if (order.department === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST) {
      recs.push(...buildSmartTrustGovernanceRecommendations(order));
      continue;
    }

    if (
      order.pipelineStage === "executive_handoff_received" &&
      order.paymentConsumed &&
      order.approvalStatus === "none"
    ) {
      recs.push({
        id: randomUUID(),
        kind: "engage_department",
        department: order.department,
        priority: "normal",
        title:
          order.department === FULFILLMENT_PRIMARY_SERVICE_TRUST
            ? "Propose trust packet"
            : "Propose Site Builder draft",
        rationale: "Handoff complete — queue executive approval for internal drafting (human desk action).",
        requiresHumanAction: true,
        relatedOrderIds: [order.orderId],
      });
    }
  }

  if (health.stalled) {
    recs.push({
      id: randomUUID(),
      kind: "stall_recovery",
      department: null,
      priority: "high",
      title: "Client fulfillment appears stalled",
      rationale: health.stallReasons.join("; "),
      requiresHumanAction: true,
      relatedOrderIds: orders.map((o) => o.orderId),
    });
  }

  if (!readiness.overallFulfillmentReady && readiness.weakestDepartment) {
    recs.push({
      id: randomUUID(),
      kind: "resolve_bottleneck",
      department: readiness.weakestDepartment,
      priority: "normal",
      title: `Strengthen ${readiness.weakestDepartment} intake`,
      rationale: readiness.narrative,
      requiresHumanAction: true,
      relatedOrderIds: orders.filter((o) => o.department === readiness.weakestDepartment).map((o) => o.orderId),
    });
  }

  const sequencing = buildFulfillmentSequencingRecommendation(orders);
  if (sequencing.recommendedOrder.length > 1) {
    recs.push({
      id: randomUUID(),
      kind: "sequence_next",
      department: sequencing.recommendedOrder[0] ?? null,
      priority: "low",
      title: `Suggested next department: ${sequencing.recommendedOrder[0]}`,
      rationale: sequencing.rationale,
      requiresHumanAction: true,
      relatedOrderIds: orders.map((o) => o.orderId),
    });
  }

  const revenueOrder = findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);
  const smartTrustOrder = findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST);
  const dep = resolveCrossDepartmentDependencyNarrative({
    websiteOrderActive: Boolean(findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_WEBSITE)),
    trustOrderActive: Boolean(findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_TRUST)),
    revenueOsOrderActive: Boolean(revenueOrder),
    smartTrustOrderActive: Boolean(smartTrustOrder),
    websiteStage: findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_WEBSITE)?.pipelineStage ?? null,
    trustStage: findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_TRUST)?.pipelineStage ?? null,
    revenueOsStage: revenueOrder?.pipelineStage ?? null,
    revenueOsLaunchReadinessApproved: revenueOrder?.launchReadinessApproved ?? false,
    smartTrustGovernanceApproved: smartTrustOrder?.governanceReviewApproved ?? false,
  });
  if (dep.websiteDependsOnTrust) {
    recs.push({
      id: randomUUID(),
      kind: "monitor_only",
      department: FULFILLMENT_PRIMARY_SERVICE_TRUST,
      priority: "low",
      title: "Coordinate TRUST before WEBSITE publish-sensitive copy",
      rationale: dep.narrative,
      requiresHumanAction: true,
      relatedOrderIds: orders.map((o) => o.orderId),
    });
  }
  if (dep.revenueOsDependsOnWebsite) {
    recs.push({
      id: randomUUID(),
      kind: "monitor_only",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      priority: "normal",
      title: "Align WEBSITE before REVENUE_OS launch readiness",
      rationale: dep.narrative,
      requiresHumanAction: true,
      relatedOrderIds: orders.map((o) => o.orderId),
    });
  }

  const seen = new Set<string>();
  const deduped = recs.filter((r) => {
    const k = `${r.kind}:${r.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return applyMemoryWeightsToRecommendations(deduped, input.memoryWeights);
}

export function detectOperationalBottlenecks(
  orders: ClientFulfillmentOrderSnapshot[]
): OperationalBottleneck[] {
  const map = new Map<
    string,
    { department: ClientFulfillmentOrderSnapshot["department"]; stage: string; count: number }
  >();

  for (const o of orders) {
    if (o.pipelineStage === "released" || o.pipelineStage === "closed") continue;
    const key = `${o.department}:${o.pipelineStage}`;
    const hit = map.get(key);
    if (hit) hit.count += 1;
    else map.set(key, { department: o.department, stage: o.pipelineStage, count: 1 });
  }

  return [...map.entries()]
    .map(([id, v]) => ({
      id,
      department: v.department,
      stage: v.stage,
      orderCount: v.count,
      summary: `${v.count} ${v.department} order(s) in "${v.stage.replace(/_/g, " ")}"`,
    }))
    .sort((a, b) => b.orderCount - a.orderCount);
}

export function summarizeWhatClientStillNeeds(input: {
  recommendations: FulfillmentRecommendation[];
  readiness: SharedClientReadinessSummary;
  health: ClientHealthScore;
}): string {
  const top = input.recommendations.slice(0, 4).map((r) => r.title);
  const parts = [
    input.readiness.narrative,
    top.length ? `Desk priorities: ${top.join("; ")}.` : "No urgent desk actions detected.",
    input.health.stalled ? `Stalled: ${input.health.stallReasons[0] ?? "review timeline"}.` : "",
  ].filter(Boolean);
  return parts.join(" ");
}
