import { randomUUID } from "crypto";
import type {
  BriefingApprovalBacklogItem,
  BriefingClientContext,
  BriefingCrossDepartmentOpportunity,
  BriefingDeskSnapshot,
  BriefingOwnerActionItem,
  BriefingOwnerActionPriority,
  BriefingRiskAlert,
  BriefingStalledClientSummary,
  BriefingStalledOrderItem,
  ExecutiveFulfillmentOperationsBriefingDto,
} from "@/lib/fulfillment/fulfillment-executive-operations-briefing-types";
import type { FulfillmentRecommendation } from "@/lib/fulfillment/fulfillment-orchestration-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

const PRIORITY_RANK: Record<BriefingOwnerActionPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function recPriority(rec: FulfillmentRecommendation): BriefingOwnerActionPriority {
  if (rec.kind === "payment_gate" || rec.kind === "stall_recovery") return "urgent";
  if (rec.kind === "approval_review") return "high";
  if (rec.priority === "high") return "high";
  if (rec.priority === "low") return "low";
  return "normal";
}

function recommendationToAction(
  rec: FulfillmentRecommendation,
  clientId: string
): BriefingOwnerActionItem {
  return {
    id: rec.id,
    priority: recPriority(rec),
    title: rec.title,
    rationale: rec.rationale,
    department: rec.department === "AI_REVENUE_OS" ? "AI_REVENUE_OS" : rec.department,
    clientId,
    orderId: rec.relatedOrderIds[0] ?? null,
    kind: rec.kind,
    requiresHumanAction: true,
  };
}

export function buildPriorityOwnerActionQueue(clients: BriefingClientContext[]): BriefingOwnerActionItem[] {
  const items: BriefingOwnerActionItem[] = [];

  for (const c of clients) {
    for (const rec of c.recommendations) {
      items.push(recommendationToAction(rec, c.clientId));
    }

    for (const order of c.orders) {
      if (order.pipelineStage === "owner_review" && order.ownerReviewStatus === "pending") {
        items.push({
          id: randomUUID(),
          priority: "high",
          title: `Owner review ${order.department} deliverable`,
          rationale:
            order.department === FULFILLMENT_PRIMARY_SERVICE_TRUST
              ? "Trust legal-review packet awaiting owner decision — no apply or client delivery."
              : "Site Builder draft awaiting owner decision — no deploy or send.",
          department: order.department,
          clientId: c.clientId,
          orderId: order.orderId,
          kind: "owner_review",
          requiresHumanAction: true,
        });
      }

      if (
        order.clientDeliveryStatus === "workspace_active" ||
        order.clientDeliveryStatus === "client_revision_requested"
      ) {
        items.push({
          id: randomUUID(),
          priority: "normal",
          title: `Monitor ${order.department} client review workspace`,
          rationale: `Client delivery status: ${order.clientDeliveryStatus.replace(/_/g, " ")} — owner retains control.`,
          department: order.department,
          clientId: c.clientId,
          orderId: order.orderId,
          kind: "client_review",
          requiresHumanAction: true,
        });
      }
    }
  }

  items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  return items;
}

export function buildApprovalBacklogActions(
  backlog: BriefingApprovalBacklogItem[]
): BriefingOwnerActionItem[] {
  return backlog.map((a) => ({
    id: a.approvalId,
    priority: "high" as const,
    title: `Approve ${a.proposedAction.replace(/([A-Z])/g, " $1").trim()}`,
    rationale: `Pending executive approval${a.orderId ? ` for order ${a.orderId.slice(0, 8)}…` : ""}.`,
    department: a.department,
    clientId: a.clientId ?? "unknown",
    orderId: a.orderId,
    kind: "approval_backlog" as const,
    requiresHumanAction: true,
  }));
}

export function buildStalledOrderItems(clients: BriefingClientContext[]): BriefingStalledOrderItem[] {
  const items: BriefingStalledOrderItem[] = [];
  for (const c of clients) {
    if (!c.stalled) continue;
    for (const o of c.orders) {
      if (o.pipelineStage === "released" || o.pipelineStage === "closed") continue;
      if (o.daysInCurrentStage >= 7 || o.approvalStatus === "pending") {
        items.push({
          orderId: o.orderId,
          clientId: c.clientId,
          department: o.department,
          pipelineStage: o.pipelineStage,
          daysInStage: o.daysInCurrentStage,
          reason:
            o.approvalStatus === "pending"
              ? "Pending executive approval"
              : `In stage ${o.pipelineStage} for ${o.daysInCurrentStage} days`,
        });
      }
    }
  }
  return items.sort((a, b) => b.daysInStage - a.daysInStage);
}

export function buildStalledClientSummaries(clients: BriefingClientContext[]): BriefingStalledClientSummary[] {
  return clients
    .filter((c) => c.stalled)
    .map((c) => ({
      clientId: c.clientId,
      healthScore: c.healthScore,
      stallReasons: c.stallReasons,
      orderIds: c.orders.map((o) => o.orderId),
    }))
    .sort((a, b) => a.healthScore - b.healthScore);
}

export function buildCrossDepartmentOpportunitySummaries(
  clients: BriefingClientContext[]
): BriefingCrossDepartmentOpportunity[] {
  const out: BriefingCrossDepartmentOpportunity[] = [];

  for (const c of clients) {
    const depts = [...new Set(c.orders.map((o) => o.department))];
    const hasWeb = depts.includes(FULFILLMENT_PRIMARY_SERVICE_WEBSITE);
    const hasTrust = depts.includes(FULFILLMENT_PRIMARY_SERVICE_TRUST);

    if (hasWeb && hasTrust) {
      out.push({
        clientId: c.clientId,
        departments: depts,
        title: "WEBSITE + TRUST coordination",
        rationale:
          "Both departments active — align entity/disclaimer language during owner review (recommendation only).",
        websiteDependsOnTrust: c.websiteDependsOnTrust,
        trustDependsOnWebsite: c.trustDependsOnWebsite,
      });
    }

    for (const opp of c.crossSellOpportunities) {
      out.push({
        clientId: c.clientId,
        departments: depts,
        title: opp.title,
        rationale: opp.rationale,
        websiteDependsOnTrust: c.websiteDependsOnTrust,
        trustDependsOnWebsite: c.trustDependsOnWebsite,
      });
    }
  }

  return out;
}

export function buildRiskAlerts(
  clients: BriefingClientContext[],
  snapshot: BriefingDeskSnapshot
): BriefingRiskAlert[] {
  const alerts: BriefingRiskAlert[] = [];

  for (const c of clients) {
    if (c.healthScore < 40) {
      alerts.push({
        id: randomUUID(),
        severity: "high",
        title: "Critical client health",
        detail: `Health score ${c.healthScore} — ${c.stallReasons[0] ?? "review fulfillment timeline"}.`,
        clientId: c.clientId,
        orderId: null,
        department: null,
      });
    }

    for (const o of c.orders) {
      if (o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST && o.pipelineStage === "owner_review") {
        alerts.push({
          id: randomUUID(),
          severity: "medium",
          title: "TRUST packet awaiting owner review",
          detail: "Legal-review boundary — attorney review recommended before client reliance.",
          clientId: c.clientId,
          orderId: o.orderId,
          department: FULFILLMENT_PRIMARY_SERVICE_TRUST,
        });
      }
      if (!o.paymentConsumed && o.paymentStatus !== "confirmed") {
        alerts.push({
          id: randomUUID(),
          severity: "high",
          title: "Payment gate open",
          detail: `${o.department} order blocked until manual payment confirmation.`,
          clientId: c.clientId,
          orderId: o.orderId,
          department: o.department,
        });
      }
    }
  }

  for (const b of snapshot.bottlenecks.filter((x) => x.orderCount >= 2)) {
    alerts.push({
      id: randomUUID(),
      severity: "medium",
      title: "Operational bottleneck",
      detail: `${b.orderCount} ${b.department} orders stuck in ${b.stage.replace(/_/g, " ")}.`,
      clientId: null,
      orderId: null,
      department: b.department,
    });
  }

  return alerts.slice(0, 20);
}

export function buildSuggestedOwnerSequence(queue: BriefingOwnerActionItem[]): BriefingOwnerActionItem[] {
  const seen = new Set<string>();
  const out: BriefingOwnerActionItem[] = [];
  for (const item of queue) {
    const key = `${item.clientId}:${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 8) break;
  }
  return out;
}

export function buildSkipperBriefingSummary(input: {
  topUrgent: BriefingOwnerActionItem[];
  stalledCount: number;
  ownerReviewCount: number;
  clientReviewCount: number;
  approvalCount: number;
  crossDeptCount: number;
  riskCount: number;
  suggestedSequence: BriefingOwnerActionItem[];
}): string {
  const parts = [
    `Top urgent: ${input.topUrgent.map((a) => a.title).join("; ") || "none"}.`,
    `Stalled orders: ${input.stalledCount}. Owner review queue: ${input.ownerReviewCount}. Client review: ${input.clientReviewCount}.`,
    `Approval backlog: ${input.approvalCount}. Cross-department opportunities: ${input.crossDeptCount}. Risks: ${input.riskCount}.`,
    input.suggestedSequence.length
      ? `Suggested day sequence: ${input.suggestedSequence.map((s) => s.title).join(" → ")}.`
      : "No sequenced desk actions — monitor queues.",
    "Recommendations only — no autonomous execution, billing, deploy, or release.",
  ];
  return parts.join(" ");
}

export function buildExecutiveFulfillmentOperationsBriefingFromDesk(
  snapshot: BriefingDeskSnapshot,
  opts?: { briefingDate?: string; now?: Date }
): ExecutiveFulfillmentOperationsBriefingDto {
  const now = opts?.now ?? new Date();
  const briefingDate = opts?.briefingDate ?? now.toISOString().slice(0, 10);

  const recActions = buildPriorityOwnerActionQueue(snapshot.clients);
  const approvalActions = buildApprovalBacklogActions(snapshot.approvalBacklog);
  const priorityQueue = [...approvalActions, ...recActions].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  );

  const stalledOrders = buildStalledOrderItems(snapshot.clients);
  const stalledClients = buildStalledClientSummaries(snapshot.clients);

  const ownerReviewPending = snapshot.orders
    .filter((o) => o.pipelineStage === "owner_review" && o.ownerReviewStatus === "pending")
    .map((o) => ({
      orderId: o.orderId,
      clientId: o.clientId,
      department: o.department,
      artifactType: null as string | null,
    }));

  const clientReviewPending = snapshot.orders
    .filter(
      (o) =>
        o.clientDeliveryStatus === "workspace_active" ||
        o.clientDeliveryStatus === "client_revision_requested"
    )
    .map((o) => ({
      orderId: o.orderId,
      clientId: o.clientId,
      department: o.department,
      clientDeliveryStatus: o.clientDeliveryStatus,
    }));

  const crossDepartmentOpportunities = buildCrossDepartmentOpportunitySummaries(snapshot.clients);
  const riskAlerts = buildRiskAlerts(snapshot.clients, snapshot);
  const topUrgentActions = priorityQueue.slice(0, 5);
  const suggestedOwnerSequence = buildSuggestedOwnerSequence(priorityQueue);

  const needsMyAttentionSummary = [
    topUrgentActions.length ? `${topUrgentActions.length} urgent desk action(s)` : null,
    stalledOrders.length ? `${stalledOrders.length} stalled order(s)` : null,
    ownerReviewPending.length ? `${ownerReviewPending.length} owner review(s)` : null,
    clientReviewPending.length ? `${clientReviewPending.length} client review workspace(s)` : null,
    snapshot.approvalBacklog.length ? `${snapshot.approvalBacklog.length} approval(s) in backlog` : null,
    crossDepartmentOpportunities.length
      ? `${crossDepartmentOpportunities.length} cross-department opportunity(ies)`
      : null,
    riskAlerts.filter((r) => r.severity === "high").length
      ? `${riskAlerts.filter((r) => r.severity === "high").length} high-severity risk(s)`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const headline =
    topUrgentActions.length > 0
      ? `${topUrgentActions.length} urgent fulfillment desk action(s) — ${briefingDate}`
      : `Fulfillment desk steady — ${briefingDate}`;

  const skipperSummary = buildSkipperBriefingSummary({
    topUrgent: topUrgentActions,
    stalledCount: stalledOrders.length,
    ownerReviewCount: ownerReviewPending.length,
    clientReviewCount: clientReviewPending.length,
    approvalCount: snapshot.approvalBacklog.length,
    crossDeptCount: crossDepartmentOpportunities.length,
    riskCount: riskAlerts.length,
    suggestedSequence: suggestedOwnerSequence,
  });

  const activeOrders = snapshot.orders.filter(
    (o) => o.pipelineStage !== "released" && o.pipelineStage !== "closed"
  ).length;

  return {
    ok: true,
    generatedAt: now.toISOString(),
    briefingDate,
    headline,
    needsMyAttention: {
      summary: needsMyAttentionSummary || "No items need immediate attention.",
      counts: {
        urgentActions: topUrgentActions.length,
        stalledOrders: stalledOrders.length,
        ownerReviewPending: ownerReviewPending.length,
        clientReviewPending: clientReviewPending.length,
        approvalBacklog: snapshot.approvalBacklog.length,
        crossDepartmentOpportunities: crossDepartmentOpportunities.length,
        riskAlerts: riskAlerts.length,
      },
    },
    topUrgentActions,
    priorityQueue: priorityQueue.slice(0, 30),
    stalledClients,
    stalledOrders,
    ownerReviewPending,
    clientReviewPending,
    approvalBacklog: snapshot.approvalBacklog,
    crossDepartmentOpportunities,
    riskAlerts,
    suggestedOwnerSequence,
    skipperSummary,
    meta: {
      recommendationOnly: true,
      noAutonomousExecution: true,
      activeOrders,
      websiteOrders: snapshot.orders.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE).length,
      trustOrders: snapshot.orders.filter((o) => o.department === FULFILLMENT_PRIMARY_SERVICE_TRUST).length,
    },
  };
}
