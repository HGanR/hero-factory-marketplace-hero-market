import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeBottleneckRecurrence } from "@/lib/fulfillment/bottleneck-analytics";
import { buildExecutiveFulfillmentOperationalMemoryInsights } from "@/lib/fulfillment/fulfillment-operational-memory-insights-builder";
import { trackFulfillmentOutcomes } from "@/lib/fulfillment/fulfillment-outcome-tracker";
import {
  applyMemoryWeightsToRecommendations,
  buildRecommendationEffectivenessSignals,
} from "@/lib/fulfillment/recommendation-feedback";
import { scoreFulfillmentSuccess } from "@/lib/fulfillment/fulfillment-success-score";
import { learnOperatorPriorityPatterns } from "@/lib/fulfillment/operator-pattern-learning";
import { buildOperationalMemoryStore } from "@/lib/fulfillment/operational-memory-store";
import type { OperationalMemoryOrderRecord } from "@/lib/fulfillment/fulfillment-operational-memory-types";
import type { FulfillmentRecommendation } from "@/lib/fulfillment/fulfillment-orchestration-types";

const websiteOrder = (overrides: Partial<OperationalMemoryOrderRecord> = {}): OperationalMemoryOrderRecord => ({
  orderId: "web-1",
  clientId: "client-a",
  department: "WEBSITE",
  pipelineStage: "service_drafting",
  approvalStatus: "none",
  ownerReviewStatus: "approved",
  clientDeliveryStatus: "client_approved",
  draftVersion: 1,
  daysInCurrentStage: 2,
  paymentConsumed: true,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
});

const trustStalled = (overrides: Partial<OperationalMemoryOrderRecord> = {}): OperationalMemoryOrderRecord => ({
  orderId: "trust-1",
  clientId: "client-b",
  department: "TRUST",
  pipelineStage: "owner_review",
  approvalStatus: "none",
  ownerReviewStatus: "pending",
  clientDeliveryStatus: "not_sent",
  draftVersion: 1,
  daysInCurrentStage: 10,
  paymentConsumed: true,
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe("operational memory analytics", () => {
  it("tracks WEBSITE low-revision and TRUST stall outcomes", () => {
    const outcomes = trackFulfillmentOutcomes(
      [websiteOrder(), trustStalled()],
      new Map()
    );
    assert.ok(outcomes.some((o) => o.outcome === "website_draft_low_revision"));
    assert.ok(outcomes.some((o) => o.outcome === "trust_packet_stalled"));
  });

  it("ranks approval_review recommendations higher when approval blocked", () => {
    const outcomes = trackFulfillmentOutcomes(
      [websiteOrder({ approvalStatus: "pending" })],
      new Map()
    );
    const signals = buildRecommendationEffectivenessSignals(outcomes);
    const approval = signals.find((s) => s.kind === "approval_review");
    assert.ok(approval && approval.effectivenessScore >= 0.7);
  });

  it("applies memory weights without mutating recommendation fields", () => {
    const recs: FulfillmentRecommendation[] = [
      {
        id: "1",
        kind: "monitor_only",
        department: "WEBSITE",
        priority: "low",
        title: "Monitor",
        rationale: "x",
        requiresHumanAction: true,
        relatedOrderIds: [],
      },
      {
        id: "2",
        kind: "approval_review",
        department: "WEBSITE",
        priority: "high",
        title: "Approve",
        rationale: "y",
        requiresHumanAction: true,
        relatedOrderIds: ["web-1"],
      },
    ];
    const sorted = applyMemoryWeightsToRecommendations(recs, { approval_review: 2, monitor_only: 0.5 });
    assert.equal(sorted[0]?.kind, "approval_review");
  });

  it("detects recurring bottlenecks by stage dwell", () => {
    const bottlenecks = analyzeBottleneckRecurrence([
      trustStalled(),
      trustStalled({ orderId: "trust-2", clientId: "client-c" }),
    ]);
    assert.ok(bottlenecks.length >= 1);
    assert.ok(bottlenecks[0]!.recurrenceScore > 0);
  });

  it("learns operator priority from audit and approvals", () => {
    const patterns = learnOperatorPriorityPatterns({
      auditActions: [
        { actionType: "memory_insights_viewed", toolName: "fulfillment.operations.memory_insights" },
        { actionType: "memory_insights_viewed", toolName: "fulfillment.operations.memory_insights" },
      ],
      approvalActions: ["createSiteBuilderTask", "createSiteBuilderTask"],
    });
    assert.ok(patterns.length >= 1);
    assert.ok(patterns[0]!.occurrenceCount >= 2);
  });

  it("builds full memory insights DTO with safety meta", () => {
    const insights = buildExecutiveFulfillmentOperationalMemoryInsights({
      orders: [websiteOrder(), trustStalled()],
      revisionEventCounts: new Map([["web-1", 0]]),
      approvals: [
        {
          id: "a1",
          proposedAction: "createSiteBuilderTask",
          targetId: "web-1",
          status: "executed",
          createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
          executedAt: new Date().toISOString(),
          department: "WEBSITE",
        },
      ],
      auditActions: [{ actionType: "memory_insights_viewed", toolName: "fulfillment.operations.memory_insights" }],
      memoryItemTitles: ["Recurring approval backlog"],
    });
    assert.equal(insights.ok, true);
    assert.equal(insights.meta.noAutonomousExecution, true);
    assert.equal(insights.meta.noAutonomousLearningActions, true);
    assert.ok(insights.memory.recommendationWeights.approval_review != null);
    assert.ok(insights.skipperSummary.includes("no autonomous"));
  });

  it("scores fulfillment success tiers", () => {
    const orders = [websiteOrder(), trustStalled()];
    const outcomes = trackFulfillmentOutcomes(orders, new Map());
    const scores = scoreFulfillmentSuccess(orders, outcomes);
    assert.ok(scores.some((s) => s.tier === "excellent" || s.tier === "good"));
    assert.ok(scores.some((s) => s.tier === "at_risk" || s.tier === "critical"));
  });

  it("operational memory store exposes recommendation weights", () => {
    const store = buildOperationalMemoryStore({
      orders: [websiteOrder({ approvalStatus: "pending" })],
      revisionEventCounts: new Map(),
      approvals: [],
      auditActions: [],
      memoryItemTitles: [],
    });
    assert.ok(Object.keys(store.recommendationWeights).length >= 4);
    assert.ok(store.recommendationSignals.length >= 4);
  });
});
