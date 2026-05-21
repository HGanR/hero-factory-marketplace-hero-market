import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSubjectSkipperContext,
  extractSubjectMemoryHighlights,
  filterRecommendationsForScope,
} from "@/lib/executive-agent/subject-memory-context";
import { resolveSubjectWorkspace } from "@/lib/executive-agent/subject-workspace-state";
import type { FulfillmentRecommendation } from "@/lib/fulfillment/fulfillment-orchestration-types";

describe("subject workspace state", () => {
  it("resolves WEBSITE workspace from site_builder subject", () => {
    const scope = resolveSubjectWorkspace({ subjectId: "site_builder" });
    assert.equal(scope.workspaceKind, "website");
    assert.equal(scope.department, "WEBSITE");
  });

  it("resolves TRUST workspace from trust_jarva", () => {
    const scope = resolveSubjectWorkspace({ subjectId: "trust_jarva" });
    assert.equal(scope.workspaceKind, "trust");
    assert.equal(scope.department, "TRUST");
  });

  it("resolves REVENUE_OS workspace from revenue_os subject", () => {
    const scope = resolveSubjectWorkspace({ subjectId: "revenue_os" });
    assert.equal(scope.workspaceKind, "revenue_os");
    assert.equal(scope.department, "REVENUE_OS");
  });

  it("resolves fulfillment_case when order pinned", () => {
    const scope = resolveSubjectWorkspace({
      subjectId: "crm_intelligence",
      orderId: "order-abc-123",
      orderDepartment: "WEBSITE",
      clientId: "client-1",
    });
    assert.equal(scope.workspaceKind, "fulfillment_case");
    assert.equal(scope.orderId, "order-abc-123");
    assert.equal(scope.department, "WEBSITE");
  });

  it("resolves WEBSITE client when site_builder + clientId", () => {
    const scope = resolveSubjectWorkspace({
      subjectId: "site_builder",
      clientId: "client-99",
    });
    assert.equal(scope.workspaceKind, "website");
    assert.equal(scope.clientId, "client-99");
  });
});

describe("subject memory context", () => {
  it("filters recommendations by department", () => {
    const scope = resolveSubjectWorkspace({ subjectId: "trust_jarva" });
    const recs: FulfillmentRecommendation[] = [
      {
        id: "1",
        kind: "approval_review",
        department: "TRUST",
        priority: "high",
        title: "Trust approval",
        rationale: "x",
        requiresHumanAction: true,
        relatedOrderIds: ["o1"],
      },
      {
        id: "2",
        kind: "engage_department",
        department: "WEBSITE",
        priority: "normal",
        title: "Website draft",
        rationale: "y",
        requiresHumanAction: true,
        relatedOrderIds: ["o2"],
      },
    ];
    const filtered = filterRecommendationsForScope(recs, scope);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.department, "TRUST");
  });

  it("builds skipper context with safety footer", () => {
    const scope = resolveSubjectWorkspace({ subjectId: "site_builder" });
    const ctx = buildSubjectSkipperContext({
      scope,
      headline: "WEBSITE desk",
      recommendations: [],
      memoryHighlights: null,
      activeOrderIds: [],
    });
    assert.ok(ctx.includes("WEBSITE"));
    assert.ok(ctx.includes("no autonomous execution"));
  });

  it("extracts department-scoped memory highlights", () => {
    const scope = resolveSubjectWorkspace({ subjectId: "trust_jarva" });
    const highlights = extractSubjectMemoryHighlights(
      {
        ok: true,
        generatedAt: new Date().toISOString(),
        headline: "h",
        skipperSummary: "s",
        memory: {
          ordersAnalyzed: 2,
          outcomes: [
            {
              orderId: "t1",
              clientId: "c1",
              department: "TRUST",
              outcome: "trust_packet_stalled",
              revisionCount: 0,
              daysInStage: 10,
              summary: "stall",
            },
            {
              orderId: "w1",
              clientId: "c2",
              department: "WEBSITE",
              outcome: "website_draft_low_revision",
              revisionCount: 0,
              daysInStage: 1,
              summary: "ok",
            },
          ],
          recommendationSignals: [],
          operatorPatterns: [],
          bottleneckRecurrence: [
            {
              id: "TRUST:owner_review",
              department: "TRUST",
              stage: "owner_review",
              currentOrderCount: 2,
              recurrenceScore: 0.8,
              repeatVisits: 1,
              summary: "TRUST stuck",
            },
          ],
          approvalLatency: [],
          clientLifecycle: [],
          successScores: [],
          recommendationWeights: {},
          learnedAt: new Date().toISOString(),
        },
        highlights: {
          websiteLowRevisionDrafts: 1,
          trustStalledPackets: 1,
          clientsNeedingGuidance: 0,
          fastestApprovalFlow: null,
          topEffectiveRecommendation: null,
          recurringBottleneck: "all",
          topOwnerPriority: null,
        },
        revisionAnalytics: {
          websiteAvgDraftVersion: 1,
          websiteRevisionRequestedRate: 0,
          trustOwnerReviewPendingRate: 0.5,
          topRevisionThemes: [],
        },
        meta: {
          recommendationOnly: true,
          noAutonomousExecution: true,
          noAutonomousLearningActions: true,
          readOnlyAnalytics: true,
        },
      },
      scope
    );
    assert.ok(highlights);
    assert.equal(highlights!.trustStalledPackets, 1);
    assert.ok(highlights!.recurringBottleneck?.includes("TRUST"));
  });
});
