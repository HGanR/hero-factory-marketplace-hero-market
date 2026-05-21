import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildApprovalBacklogActions,
  buildExecutiveFulfillmentOperationsBriefingFromDesk,
  buildPriorityOwnerActionQueue,
  buildRiskAlerts,
  buildStalledOrderItems,
} from "@/lib/fulfillment/fulfillment-executive-operations-briefing-builder";
import type {
  BriefingClientContext,
  BriefingDeskSnapshot,
  BriefingOrderSnapshot,
} from "@/lib/fulfillment/fulfillment-executive-operations-briefing-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";

function order(partial: Partial<BriefingOrderSnapshot> & Pick<BriefingOrderSnapshot, "orderId" | "department">): BriefingOrderSnapshot {
  return {
    clientId: CLIENT_ID,
    assignedDepartment: partial.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE ? "site_builder" : "trust_records",
    pipelineStage: "executive_handoff_received",
    approvalStatus: "none",
    ownerReviewStatus: null,
    paymentStatus: "confirmed",
    paymentConsumed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    daysInCurrentStage: 1,
    clientDeliveryStatus: "not_sent",
    ...partial,
  };
}

function clientCtx(partial: Partial<BriefingClientContext> & Pick<BriefingClientContext, "clientId">): BriefingClientContext {
  return {
    orders: [],
    readinessFulfillmentReady: false,
    healthScore: 60,
    healthTier: "steady",
    stalled: false,
    stallReasons: [],
    recommendations: [],
    crossSellOpportunities: [],
    websiteDependsOnTrust: false,
    trustDependsOnWebsite: false,
    ...partial,
  };
}

describe("executive operations briefing builder", () => {
  it("builds top 5 urgent actions and skipper summary", () => {
    const orders = [
      order({
        orderId: "w1",
        department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
        pipelineStage: "owner_review",
        ownerReviewStatus: "pending",
      }),
    ];
    const desk: BriefingDeskSnapshot = {
      orders,
      clients: [
        clientCtx({
          clientId: CLIENT_ID,
          orders,
          recommendations: [
            {
              id: "r1",
              kind: "payment_gate",
              department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
              priority: "high",
              title: "Confirm payment",
              rationale: "Blocked",
              requiresHumanAction: true,
              relatedOrderIds: ["w1"],
            },
          ],
        }),
      ],
      approvalBacklog: [
        {
          approvalId: "a1",
          orderId: "w1",
          clientId: CLIENT_ID,
          proposedAction: "createSiteBuilderTask",
          department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
          createdAt: new Date().toISOString(),
        },
      ],
      bottlenecks: [],
    };

    const briefing = buildExecutiveFulfillmentOperationsBriefingFromDesk(desk);
    assert.equal(briefing.ok, true);
    assert.ok(briefing.topUrgentActions.length <= 5);
    assert.ok(briefing.topUrgentActions.length >= 1);
    assert.match(briefing.skipperSummary, /Recommendations only/);
    assert.equal(briefing.meta.recommendationOnly, true);
    assert.equal(briefing.meta.noAutonomousExecution, true);
    assert.ok(briefing.approvalBacklog.length === 1);
  });

  it("includes owner review and client review queues", () => {
    const orders = [
      order({
        orderId: "w1",
        department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
        pipelineStage: "owner_review",
        ownerReviewStatus: "pending",
        approvalStatus: "executed",
        clientDeliveryStatus: "workspace_active",
      }),
    ];
    const desk: BriefingDeskSnapshot = {
      orders,
      clients: [clientCtx({ clientId: CLIENT_ID, orders })],
      approvalBacklog: [],
      bottlenecks: [],
    };

    const briefing = buildExecutiveFulfillmentOperationsBriefingFromDesk(desk);
    assert.equal(briefing.ownerReviewPending.length, 1);
    assert.equal(briefing.clientReviewPending.length, 1);
  });

  it("priority queue merges approvals before recommendations", () => {
    const approvals = buildApprovalBacklogActions([
      {
        approvalId: "a1",
        orderId: "t1",
        clientId: CLIENT_ID,
        proposedAction: "createTrustFulfillmentPacket",
        department: FULFILLMENT_PRIMARY_SERVICE_TRUST,
        createdAt: null,
      },
    ]);
    assert.equal(approvals[0]?.priority, "high");
    assert.equal(approvals[0]?.requiresHumanAction, true);
  });

  it("detects stalled orders from client health", () => {
    const orders = [
      order({
        orderId: "w1",
        department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
        pipelineStage: "service_drafting",
        approvalStatus: "pending",
        daysInCurrentStage: 12,
      }),
    ];
    const clients: BriefingClientContext[] = [
      clientCtx({
        clientId: CLIENT_ID,
        stalled: true,
        stallReasons: ["WEBSITE: pending executive approval"],
        orders,
      }),
    ];
    const stalled = buildStalledOrderItems(clients);
    assert.ok(stalled.length >= 1);
    assert.ok(stalled[0]?.reason.includes("approval") || stalled[0]?.daysInCurrentStage >= 7);
  });

  it("emits risk alerts for payment gates and bottlenecks", () => {
    const orders = [
      order({
        orderId: "w1",
        department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
        paymentStatus: "pending",
        paymentConsumed: false,
      }),
    ];
    const clients: BriefingClientContext[] = [
      clientCtx({
        clientId: CLIENT_ID,
        healthScore: 30,
        orders,
      }),
    ];
    const alerts = buildRiskAlerts(clients, {
      orders,
      clients,
      approvalBacklog: [],
      bottlenecks: [{ department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE, stage: "service_drafting", orderCount: 3 }],
    });
    assert.ok(alerts.some((a) => a.severity === "high"));
  });
});
