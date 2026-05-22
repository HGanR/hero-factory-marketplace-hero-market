import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectClaudeFulfillmentHandoffPrimary,
  revenueOsDeskOnlyHandoffResult,
} from "@/lib/fulfillment/claude-fulfillment-handoff-routing";
import { buildClientOperationsGraph } from "@/lib/fulfillment/client-operations-graph";
import { resolveCrossDepartmentDependencyNarrative } from "@/lib/fulfillment/department-dependency-map";
import {
  buildFulfillmentRecommendations,
  buildFulfillmentSequencingRecommendation,
} from "@/lib/fulfillment/fulfillment-recommendation-engine";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import { buildSharedClientReadinessSummary, computeClientHealthScore } from "@/lib/fulfillment/client-health-score";
import { buildRevisionThemeHints, computeRevisionAnalytics } from "@/lib/fulfillment/operational-memory-store";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

const CLIENT_ID = "00000000-0000-4000-8000-000000000010";

function snap(
  partial: Partial<ClientFulfillmentOrderSnapshot> & Pick<ClientFulfillmentOrderSnapshot, "orderId" | "department">
): ClientFulfillmentOrderSnapshot {
  return {
    clientId: CLIENT_ID,
    assignedDepartment: "ai_revenue_os",
    pipelineStage: "service_drafting",
    approvalStatus: "none",
    ownerReviewStatus: null,
    paymentStatus: "confirmed",
    paymentConsumed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    daysInCurrentStage: 2,
    campaignId: null,
    launchReadinessApproved: false,
    revisionRound: 0,
    ...partial,
  };
}

describe("REVENUE_OS orchestration integration", () => {
  it("rejects Claude worker handoff for REVENUE_OS (desk-only intake)", () => {
    const primary = detectClaudeFulfillmentHandoffPrimary({ service: { primary: "REVENUE_OS" } });
    assert.equal(primary, FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS);
    const result = revenueOsDeskOnlyHandoffResult();
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "revenue_os_desk_only");
    }
  });

  it("graphs REVENUE_OS order with WEBSITE coordination edges", () => {
    const web = snap({ orderId: "w1", department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE, pipelineStage: "service_drafting" });
    const rev = snap({
      orderId: "r1",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      campaignId: "camp-1",
      pipelineStage: "owner_review",
    });
    const graph = buildClientOperationsGraph({
      clientId: CLIENT_ID,
      orders: [web, rev],
      campaignCount: 1,
    });
    assert.ok(graph.edges.some((e) => e.label.includes("REVENUE_OS")));
    assert.ok(
      graph.multiOrderRelationships.some((r) =>
        r.departments.includes(FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS)
      )
    );
  });

  it("recommends campaign review and launch readiness for REVENUE_OS", () => {
    const rev = snap({
      orderId: "r1",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      campaignId: "camp-99",
      pipelineStage: "executive_handoff_received",
    });
    const readiness = buildSharedClientReadinessSummary({
      clientId: CLIENT_ID,
      orders: [
        {
          primaryService: "REVENUE_OS",
          executiveHandoffJson: JSON.stringify({ campaignId: "camp-99", revisionRound: 0 }),
          salesSummaryText: "Campaign intake",
          requestedDeliverableJson: null,
          pipelineStage: "executive_handoff_received",
        },
      ],
    });
    const health = computeClientHealthScore({ clientId: CLIENT_ID, orders: [rev], readiness });
    const recs = buildFulfillmentRecommendations({
      clientId: CLIENT_ID,
      orders: [rev],
      graph: buildClientOperationsGraph({ clientId: CLIENT_ID, orders: [rev], campaignCount: 1 }),
      readiness,
      health,
      campaignCount: 1,
      websiteApprovedForRelease: false,
      revenueOsKpiAtRisk: false,
    });
    assert.ok(recs.some((r) => /campaign review/i.test(r.title)));
  });

  it("dependency narrative includes REVENUE_OS launch gating", () => {
    const n = resolveCrossDepartmentDependencyNarrative({
      websiteOrderActive: true,
      trustOrderActive: false,
      revenueOsOrderActive: true,
      websiteStage: "service_drafting",
      trustStage: null,
      revenueOsStage: "owner_review",
      revenueOsLaunchReadinessApproved: false,
    });
    assert.equal(n.revenueOsDependsOnWebsite, true);
    assert.match(n.narrative, /REVENUE_OS/i);
    assert.match(n.narrative, /no autonomous launch/i);
  });

  it("sequencing includes REVENUE_OS when active with TRUST and WEBSITE", () => {
    const seq = buildFulfillmentSequencingRecommendation([
      snap({ orderId: "w1", department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE }),
      snap({ orderId: "t1", department: FULFILLMENT_PRIMARY_SERVICE_TRUST }),
      snap({ orderId: "r1", department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS, campaignId: "c1" }),
    ]);
    assert.ok(seq.recommendedOrder.includes(FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS));
  });

  it("operational memory revision themes include revenue os launch blockers", () => {
    const themes = buildRevisionThemeHints({
      websiteRevisionRate: 0.1,
      trustStallRate: 0.1,
      revenueOsRevisionRate: 0.5,
      revenueOsLaunchBlockedRate: 0.3,
      memoryItemTitles: ["REVENUE_OS approval backlog"],
    });
    assert.ok(themes.includes("launch_readiness_blocker"));
  });

  it("computeRevisionAnalytics tracks REVENUE_OS metrics", () => {
    const stats = computeRevisionAnalytics([
      {
        orderId: "r1",
        clientId: CLIENT_ID,
        department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
        pipelineStage: "owner_review",
        approvalStatus: "pending",
        ownerReviewStatus: "pending",
        clientDeliveryStatus: "not_sent",
        draftVersion: 3,
        daysInCurrentStage: 5,
        paymentConsumed: true,
        updatedAt: null,
        createdAt: null,
      },
    ]);
    assert.ok(stats.revenueOsAvgRevisionRound >= 1);
    assert.ok(stats.revenueOsLaunchBlockedRate > 0);
  });
});
