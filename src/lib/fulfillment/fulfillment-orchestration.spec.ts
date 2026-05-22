import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClientOperationsGraph } from "@/lib/fulfillment/client-operations-graph";
import {
  buildSharedClientReadinessSummary,
  computeClientHealthScore,
  detectClientStallReasons,
} from "@/lib/fulfillment/client-health-score";
import {
  listAllDepartmentDependencies,
  resolveCrossDepartmentDependencyNarrative,
} from "@/lib/fulfillment/department-dependency-map";
import {
  buildFulfillmentRecommendations,
  buildFulfillmentSequencingRecommendation,
  detectCrossSellOpportunities,
  summarizeWhatClientStillNeeds,
} from "@/lib/fulfillment/fulfillment-recommendation-engine";
import type { ClientFulfillmentOrderSnapshot } from "@/lib/fulfillment/fulfillment-orchestration-types";
import { buildUnifiedClientTimeline } from "@/lib/fulfillment/unified-client-timeline";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

const CLIENT_ID = "00000000-0000-4000-8000-000000000001";

function order(partial: Partial<ClientFulfillmentOrderSnapshot> & Pick<ClientFulfillmentOrderSnapshot, "orderId" | "department">): ClientFulfillmentOrderSnapshot {
  return {
    clientId: CLIENT_ID,
    assignedDepartment:
      partial.department === FULFILLMENT_PRIMARY_SERVICE_WEBSITE
        ? "site_builder"
        : partial.department === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS
          ? "ai_revenue_os"
          : "trust_records",
    pipelineStage: "executive_handoff_received",
    approvalStatus: "none",
    ownerReviewStatus: null,
    paymentStatus: "confirmed",
    paymentConsumed: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    daysInCurrentStage: 1,
    ...partial,
  };
}

describe("department dependency map", () => {
  it("lists WEBSITE and TRUST dependencies without hard gates", () => {
    const deps = listAllDepartmentDependencies();
    assert.ok(deps.some((d) => d.from === "TRUST" && d.to === "WEBSITE" && d.optional));
    assert.ok(deps.some((d) => d.from === "WEBSITE" && d.to === "AI_REVENUE_OS"));
  });

  it("TRUST does not depend on WEBSITE", () => {
    const n = resolveCrossDepartmentDependencyNarrative({
      websiteOrderActive: true,
      trustOrderActive: true,
      websiteStage: "service_drafting",
      trustStage: "owner_review",
    });
    assert.equal(n.trustDependsOnWebsite, false);
  });

  it("flags optional WEBSITE benefit from TRUST when WEBSITE is early", () => {
    const n = resolveCrossDepartmentDependencyNarrative({
      websiteOrderActive: true,
      trustOrderActive: true,
      websiteStage: "service_drafting",
      trustStage: "owner_review",
    });
    assert.equal(n.websiteDependsOnTrust, true);
    assert.match(n.narrative, /recommendation only/i);
  });
});

describe("client operations graph", () => {
  it("tracks multi-order relationships for same client", () => {
    const web = order({ orderId: "w1", department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE });
    const trust = order({ orderId: "t1", department: FULFILLMENT_PRIMARY_SERVICE_TRUST });
    const graph = buildClientOperationsGraph({ clientId: CLIENT_ID, orders: [web, trust] });
    assert.ok(graph.multiOrderRelationships.some((r) => r.kind === "same_client"));
    assert.ok(graph.multiOrderRelationships.some((r) => r.kind === "cross_department_coordination"));
    assert.ok(graph.edges.some((e) => e.kind === "depends_on"));
  });

  it("links REVENUE_OS fulfillment order to campaign signal", () => {
    const rev = order({
      orderId: "r1",
      department: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
      campaignId: "camp-1",
      launchReadinessApproved: false,
    });
    const graph = buildClientOperationsGraph({
      clientId: CLIENT_ID,
      orders: [rev],
      campaignCount: 1,
    });
    assert.ok(graph.nodes.some((n) => n.department === "REVENUE_OS" && n.kind === "campaign_signal"));
    assert.ok(graph.edges.some((e) => e.label.includes("governed campaign fulfillment")));
  });
});

describe("fulfillment recommendation engine", () => {
  it("recommends propose draft when handoff complete — no autonomous execution flag", () => {
    const web = order({
      orderId: "w1",
      department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      pipelineStage: "executive_handoff_received",
      paymentConsumed: true,
    });
    const readiness = buildSharedClientReadinessSummary({
      clientId: CLIENT_ID,
      orders: [
        {
          primaryService: "WEBSITE",
          executiveHandoffJson: null,
          salesSummaryText: "Paid for website",
          requestedDeliverableJson: JSON.stringify({ type: "site_builder_package", title: "Site" }),
        },
      ],
    });
    const health = computeClientHealthScore({ clientId: CLIENT_ID, orders: [web], readiness });
    const graph = buildClientOperationsGraph({ clientId: CLIENT_ID, orders: [web] });
    const recs = buildFulfillmentRecommendations({
      clientId: CLIENT_ID,
      orders: [web],
      graph,
      readiness,
      health,
      campaignCount: 0,
      websiteApprovedForRelease: false,
    });
    assert.ok(recs.some((r) => r.title.includes("Site Builder")));
    assert.ok(recs.every((r) => r.requiresHumanAction === true));
  });

  it("detects REVENUE_OS cross-sell advisory when WEBSITE approved and no campaigns", () => {
    const web = order({
      orderId: "w1",
      department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      pipelineStage: "approved_for_release",
    });
    const readiness = buildSharedClientReadinessSummary({ clientId: CLIENT_ID, orders: [] });
    const health = computeClientHealthScore({ clientId: CLIENT_ID, orders: [web], readiness });
    const ops = detectCrossSellOpportunities({
      clientId: CLIENT_ID,
      orders: [web],
      graph: buildClientOperationsGraph({ clientId: CLIENT_ID, orders: [web] }),
      readiness,
      health,
      campaignCount: 0,
      websiteApprovedForRelease: true,
    });
    assert.ok(
      ops.some((o) => o.target === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS && o.advisoryOnly)
    );
  });

  it("sequences TRUST before WEBSITE when trust review is ahead", () => {
    const web = order({
      orderId: "w1",
      department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      pipelineStage: "service_drafting",
    });
    const trust = order({
      orderId: "t1",
      department: FULFILLMENT_PRIMARY_SERVICE_TRUST,
      pipelineStage: "owner_review",
      ownerReviewStatus: "pending",
    });
    const seq = buildFulfillmentSequencingRecommendation([web, trust]);
    assert.deepEqual(seq.recommendedOrder[0], FULFILLMENT_PRIMARY_SERVICE_TRUST);
  });
});

describe("client health and stall detection", () => {
  it("marks stalled when approval pending too long", () => {
    const stalled = order({
      orderId: "w1",
      department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      approvalStatus: "pending",
      daysInCurrentStage: 10,
    });
    const reasons = detectClientStallReasons([stalled]);
    assert.ok(reasons.some((r) => /pending executive approval/i.test(r)));
  });

  it("summarizes what client still needs for Skipper", () => {
    const web = order({
      orderId: "w1",
      department: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
      approvalStatus: "pending",
    });
    const readiness = buildSharedClientReadinessSummary({ clientId: CLIENT_ID, orders: [] });
    const health = computeClientHealthScore({ clientId: CLIENT_ID, orders: [web], readiness });
    const recs = buildFulfillmentRecommendations({
      clientId: CLIENT_ID,
      orders: [web],
      graph: buildClientOperationsGraph({ clientId: CLIENT_ID, orders: [web] }),
      readiness,
      health,
      campaignCount: 0,
      websiteApprovedForRelease: false,
    });
    const brief = summarizeWhatClientStillNeeds({ recommendations: recs, readiness, health });
    assert.match(brief, /Desk priorities/i);
  });
});

describe("unified client timeline", () => {
  it("merges payment and multi-department events chronologically", () => {
    const timeline = buildUnifiedClientTimeline({
      payments: [
        {
          id: "p1",
          status: "confirmed",
          confirmedAt: "2026-01-01T12:00:00.000Z",
          consumedAt: "2026-01-02T12:00:00.000Z",
          orderId: "w1",
        },
      ],
      events: [
        {
          id: "e1",
          orderId: "w1",
          primaryService: "WEBSITE",
          actorType: "claude_worker",
          fromStage: null,
          toStage: "executive_handoff_received",
          payloadJson: null,
          createdAt: "2026-01-02T11:00:00.000Z",
        },
        {
          id: "e2",
          orderId: "t1",
          primaryService: "TRUST",
          actorType: "admin_human",
          fromStage: "executive_handoff_received",
          toStage: "service_drafting",
          payloadJson: JSON.stringify({ proposedAction: "createTrustFulfillmentPacket" }),
          createdAt: "2026-01-03T12:00:00.000Z",
        },
      ],
    });
    assert.equal(timeline.length, 4);
    assert.ok(timeline.some((t) => t.department === "WEBSITE"));
    assert.ok(timeline.some((t) => t.department === "TRUST"));
  });
});

describe("orchestration safety", () => {
  it("recommendation engine source has no order creation or deploy paths", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/lib/fulfillment/fulfillment-recommendation-engine.ts"),
      "utf8"
    );
    assert.doesNotMatch(src, /insert\(clientServiceOrders\)/i);
    assert.doesNotMatch(src, /\.(deploy|publish)\(/i);
    assert.match(src, /requiresHumanAction:\s*true/);
  });
});
