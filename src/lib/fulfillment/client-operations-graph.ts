import type {
  ClientFulfillmentOrderSnapshot,
  ClientOperationsGraph,
  ClientOperationsGraphEdge,
  ClientOperationsGraphNode,
  MultiOrderRelationship,
} from "@/lib/fulfillment/fulfillment-orchestration-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export type BuildClientOperationsGraphInput = {
  clientId: string;
  orders: ClientFulfillmentOrderSnapshot[];
  campaignCount?: number;
  unconsumedPaymentCount?: number;
};

function isWebsiteOrder(o: ClientFulfillmentOrderSnapshot): boolean {
  return o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE;
}

function isTrustOrder(o: ClientFulfillmentOrderSnapshot): boolean {
  return o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST;
}

function isRevenueOsOrder(o: ClientFulfillmentOrderSnapshot): boolean {
  return o.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS;
}

function buildMultiOrderRelationships(
  orders: ClientFulfillmentOrderSnapshot[]
): MultiOrderRelationship[] {
  const rels: MultiOrderRelationship[] = [];
  if (orders.length >= 2) {
    rels.push({
      kind: "same_client",
      orderIds: orders.map((o) => o.orderId),
      departments: [...new Set(orders.map((o) => o.department))],
      summary: `${orders.length} fulfillment orders tracked for this client across ${new Set(orders.map((o) => o.department)).size} department(s).`,
    });
  }

  const web = orders.find(isWebsiteOrder);
  const trust = orders.find(isTrustOrder);
  const revenue = orders.find(isRevenueOsOrder);

  if (web && trust) {
    rels.push({
      kind: "cross_department_coordination",
      orderIds: [web.orderId, trust.orderId],
      departments: [FULFILLMENT_PRIMARY_SERVICE_WEBSITE, FULFILLMENT_PRIMARY_SERVICE_TRUST],
      summary:
        "WEBSITE and TRUST orders coexist — coordinate entity/disclaimer language during owner review; no automatic cross-routing.",
    });

    const webEarly =
      web.pipelineStage === "executive_handoff_received" ||
      web.pipelineStage === "service_drafting" ||
      web.pipelineStage === "fulfillment_queued";
    const trustLater =
      trust.pipelineStage === "owner_review" ||
      trust.pipelineStage === "approved_for_release" ||
      trust.pipelineStage === "released";
    if (webEarly && trustLater) {
      rels.push({
        kind: "sequencing_hint",
        orderIds: [trust.orderId, web.orderId],
        departments: [FULFILLMENT_PRIMARY_SERVICE_TRUST, FULFILLMENT_PRIMARY_SERVICE_WEBSITE],
        summary:
          "TRUST legal-review progress is ahead of WEBSITE drafting — consider aligning WEBSITE copy after TRUST owner review (recommendation only).",
      });
    }
  }

  if (revenue && web) {
    rels.push({
      kind: "cross_department_coordination",
      orderIds: [revenue.orderId, web.orderId],
      departments: [FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS, FULFILLMENT_PRIMARY_SERVICE_WEBSITE],
      summary:
        "REVENUE_OS campaign fulfillment and WEBSITE coexist — align landing experience before launch readiness checkpoint (no autonomous launch).",
    });
    const webNotReleased =
      web.pipelineStage !== "approved_for_release" && web.pipelineStage !== "released";
    if (webNotReleased) {
      rels.push({
        kind: "sequencing_hint",
        orderIds: [web.orderId, revenue.orderId],
        departments: [FULFILLMENT_PRIMARY_SERVICE_WEBSITE, FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS],
        summary:
          "WEBSITE not released — recommend WEBSITE progress before heavy campaign launch (soft prerequisite only).",
      });
    }
  }

  if (revenue && trust) {
    rels.push({
      kind: "parallel_safe",
      orderIds: [revenue.orderId, trust.orderId],
      departments: [FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS, FULFILLMENT_PRIMARY_SERVICE_TRUST],
      summary:
        "REVENUE_OS and TRUST proceed independently — do not conflate campaign review packets with trust apply or legal execution.",
    });
  }

  return rels;
}

/**
 * Builds a read-only client operations graph from fulfillment order snapshots.
 */
export function buildClientOperationsGraph(input: BuildClientOperationsGraphInput): ClientOperationsGraph {
  const nodes: ClientOperationsGraphNode[] = [
    {
      id: `client:${input.clientId}`,
      kind: "client",
      label: "CRM client",
      department: null,
    },
  ];
  const edges: ClientOperationsGraphEdge[] = [];

  for (const order of input.orders) {
    const orderNodeId = `order:${order.orderId}`;
    nodes.push({
      id: orderNodeId,
      kind: "fulfillment_order",
      label: `${order.department} order`,
      department: order.department,
      meta: {
        pipelineStage: order.pipelineStage,
        approvalStatus: order.approvalStatus,
        stalled: order.daysInCurrentStage >= 7,
        campaignId: order.campaignId ?? null,
        launchReadinessApproved: order.launchReadinessApproved ?? false,
      },
    });
    edges.push({
      id: `edge:client-order:${order.orderId}`,
      from: `client:${input.clientId}`,
      to: orderNodeId,
      kind: "owns_order",
      label: "owns fulfillment order",
    });

    if (!order.paymentConsumed && order.paymentStatus === "confirmed") {
      const payId = `payment:unconsumed:${order.orderId}`;
      nodes.push({
        id: payId,
        kind: "payment_confirmation",
        label: "Confirmed payment (unconsumed)",
        department: order.department,
      });
      edges.push({
        id: `edge:pay-order:${order.orderId}`,
        from: payId,
        to: orderNodeId,
        kind: "paid_by",
        label: "payment linked",
      });
    }

    if (order.approvalStatus === "pending") {
      edges.push({
        id: `edge:block-approval:${order.orderId}`,
        from: orderNodeId,
        to: `client:${input.clientId}`,
        kind: "blocks_progress",
        label: "pending executive approval",
      });
    }

    if (order.ownerReviewStatus === "pending" && order.pipelineStage === "owner_review") {
      nodes.push({
        id: `deliverable:${order.orderId}`,
        kind: "deliverable",
        label: `${order.department} deliverable pending review`,
        department: order.department,
      });
      edges.push({
        id: `edge:deliverable:${order.orderId}`,
        from: `deliverable:${order.orderId}`,
        to: orderNodeId,
        kind: "deliverable_for",
        label: "owner review queue",
      });
    }

    if (
      isRevenueOsOrder(order) &&
      !order.launchReadinessApproved &&
      (order.approvalStatus === "pending" || order.pipelineStage === "owner_review")
    ) {
      edges.push({
        id: `edge:launch-blockers:${order.orderId}`,
        from: orderNodeId,
        to: `client:${input.clientId}`,
        kind: "blocks_progress",
        label: "launch readiness checkpoint or approval pending",
      });
    }
  }

  const web = input.orders.find(isWebsiteOrder);
  const trust = input.orders.find(isTrustOrder);
  const revenue = input.orders.find(isRevenueOsOrder);

  if (web && trust) {
    edges.push({
      id: `edge:depends:web-trust:${web.orderId}:${trust.orderId}`,
      from: `order:${web.orderId}`,
      to: `order:${trust.orderId}`,
      kind: "depends_on",
      label: "optional WEBSITE ← TRUST coordination",
    });
    edges.push({
      id: `edge:relates:trust-web:${trust.orderId}:${web.orderId}`,
      from: `order:${trust.orderId}`,
      to: `order:${web.orderId}`,
      kind: "relates_to",
      label: "informational TRUST ↔ WEBSITE link",
    });
  }

  if (revenue && web) {
    edges.push({
      id: `edge:depends:revenue-web:${revenue.orderId}:${web.orderId}`,
      from: `order:${revenue.orderId}`,
      to: `order:${web.orderId}`,
      kind: "depends_on",
      label: "REVENUE_OS launch benefits from WEBSITE release (soft)",
    });
  }

  if (revenue && trust) {
    edges.push({
      id: `edge:relates:revenue-trust:${revenue.orderId}:${trust.orderId}`,
      from: `order:${revenue.orderId}`,
      to: `order:${trust.orderId}`,
      kind: "relates_to",
      label: "informational REVENUE_OS ↔ TRUST",
    });
  }

  const campaignSignalDept = revenue
    ? FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS
    : ("AI_REVENUE_OS" as const);

  if ((input.campaignCount ?? 0) > 0 || revenue?.campaignId) {
    nodes.push({
      id: `campaign:${input.clientId}`,
      kind: "campaign_signal",
      label: revenue ? "REVENUE_OS campaign fulfillment" : "AI Revenue OS campaigns",
      department: campaignSignalDept,
      meta: {
        count: input.campaignCount ?? 0,
        linkedCampaignId: revenue?.campaignId ?? null,
      },
    });
    edges.push({
      id: `edge:client-campaign:${input.clientId}`,
      from: `client:${input.clientId}`,
      to: `campaign:${input.clientId}`,
      kind: "relates_to",
      label: "Revenue OS activity signal",
    });
    if (revenue) {
      edges.push({
        id: `edge:order-campaign:${revenue.orderId}`,
        from: `order:${revenue.orderId}`,
        to: `campaign:${input.clientId}`,
        kind: "relates_to",
        label: "governed campaign fulfillment order",
      });
    }
  }

  return {
    clientId: input.clientId,
    nodes,
    edges,
    multiOrderRelationships: buildMultiOrderRelationships(input.orders),
  };
}
