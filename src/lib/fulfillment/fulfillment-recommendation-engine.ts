import { randomUUID } from "crypto";
import { resolveCrossDepartmentDependencyNarrative } from "@/lib/fulfillment/department-dependency-map";
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
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export type RecommendationEngineInput = {
  clientId: string;
  orders: ClientFulfillmentOrderSnapshot[];
  graph: ClientOperationsGraph;
  readiness: SharedClientReadinessSummary;
  health: ClientHealthScore;
  campaignCount: number;
  websiteApprovedForRelease: boolean;
};

function findOrder(orders: ClientFulfillmentOrderSnapshot[], dept: "WEBSITE" | "TRUST") {
  return orders.find((o) => o.department === dept) ?? null;
}

export function buildFulfillmentSequencingRecommendation(
  orders: ClientFulfillmentOrderSnapshot[]
): FulfillmentSequencingRecommendation {
  const web = findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
  const trust = findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_TRUST);
  const blockedBy: Array<typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE | typeof FULFILLMENT_PRIMARY_SERVICE_TRUST> =
    [];

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

  if (web && !trust) {
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

  return {
    recommendedOrder: [FULFILLMENT_PRIMARY_SERVICE_TRUST, FULFILLMENT_PRIMARY_SERVICE_WEBSITE],
    rationale:
      "Parallel desk work allowed — default sequencing favors TRUST legal-review clarity before WEBSITE publish-sensitive copy, but neither blocks the other.",
    blockedBy,
  };
}

export function detectCrossSellOpportunities(input: RecommendationEngineInput): CrossSellOpportunity[] {
  const ops: CrossSellOpportunity[] = [];
  const web = findOrder(input.orders, FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
  const trust = findOrder(input.orders, FULFILLMENT_PRIMARY_SERVICE_TRUST);

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

  if (input.websiteApprovedForRelease && input.campaignCount === 0) {
    ops.push({
      id: randomUUID(),
      target: "AI_REVENUE_OS",
      title: "AI Revenue OS onboarding (advisory)",
      rationale:
        "WEBSITE draft approved for internal release and no campaigns on file — human desk may evaluate AI Revenue OS onboarding; no automatic campaign sync or publish.",
      confidence: "medium",
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
            : "Review Site Builder draft internally — no deploy or client send from this recommendation.",
        requiresHumanAction: true,
        relatedOrderIds: [order.orderId],
      });
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

  const dep = resolveCrossDepartmentDependencyNarrative({
    websiteOrderActive: Boolean(findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_WEBSITE)),
    trustOrderActive: Boolean(findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_TRUST)),
    websiteStage: findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_WEBSITE)?.pipelineStage ?? null,
    trustStage: findOrder(orders, FULFILLMENT_PRIMARY_SERVICE_TRUST)?.pipelineStage ?? null,
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

  const seen = new Set<string>();
  return recs.filter((r) => {
    const k = `${r.kind}:${r.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
