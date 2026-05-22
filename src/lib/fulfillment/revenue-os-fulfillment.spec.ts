import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCampaignFulfillmentIntakeMarkdown,
  buildCampaignReviewPacketMarkdown,
} from "@/lib/fulfillment/revenue-os-campaign-review";
import { parseRevenueOsFulfillmentHandoff, mergeRevenueOsFulfillmentHandoff } from "@/lib/fulfillment/revenue-os-fulfillment-handoff";
import {
  assessKpiHealth,
  buildRevenueOsKpiSnapshot,
  countPostsByStatus,
} from "@/lib/fulfillment/revenue-os-kpi-snapshot";
import { buildLaunchReadinessAssessment, detectLaunchBlockers } from "@/lib/fulfillment/revenue-os-launch-readiness";
import { buildRevisionIntelligence, classifyRevisionPattern } from "@/lib/fulfillment/revenue-os-revision-intelligence";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";
import { resolveSubjectWorkspace } from "@/lib/executive-agent/subject-workspace-state";
import { isWriteAction, WRITE_ACTION_NAMES } from "@/lib/executive-agent/executive-agent-policy";
import { FULFILLMENT_ORCHESTRATION_DEPARTMENTS } from "@/lib/fulfillment/fulfillment-orchestration-types";

const CAMPAIGN_ID = "00000000-0000-4000-8000-000000000099";

describe("REVENUE_OS fulfillment handoff", () => {
  it("parses campaignId and revision round from handoff json", () => {
    const h = parseRevenueOsFulfillmentHandoff(
      JSON.stringify({ campaignId: CAMPAIGN_ID, revisionRound: 2, intakeKind: "campaign_fulfillment" })
    );
    assert.equal(h.campaignId, CAMPAIGN_ID);
    assert.equal(h.revisionRound, 2);
  });

  it("merges launch readiness approval without dropping campaignId", () => {
    const merged = mergeRevenueOsFulfillmentHandoff(
      JSON.stringify({ campaignId: CAMPAIGN_ID }),
      { launchReadinessApprovedAt: "2026-05-18T00:00:00.000Z" }
    );
    const h = parseRevenueOsFulfillmentHandoff(merged);
    assert.equal(h.campaignId, CAMPAIGN_ID);
    assert.ok(h.launchReadinessApprovedAt);
  });
});

describe("campaign review packet", () => {
  it("includes governed disclaimer themes in intake markdown", () => {
    const md = buildCampaignFulfillmentIntakeMarkdown({
      campaignId: CAMPAIGN_ID,
      campaignName: "Spring push",
      campaignStatus: "DRAFT",
      objective: "Awareness",
      bentleyGenerationJson: { hooks: ["a"] },
    });
    assert.match(md, /Campaign fulfillment intake/i);
    assert.match(md, /owner reviews/i);
  });

  it("builds review packet with revision round", () => {
    const md = buildCampaignReviewPacketMarkdown({
      orderId: "order-1",
      clientId: "client-1",
      revisionRound: 1,
      salesSummaryExcerpt: null,
      intake: {
        campaignId: CAMPAIGN_ID,
        campaignName: "Test",
        campaignStatus: "DRAFT",
        objective: null,
        bentleyGenerationJson: null,
      },
    });
    assert.match(md, /Revision round: 1/);
  });
});

describe("KPI snapshot", () => {
  it("counts post statuses", () => {
    const c = countPostsByStatus([
      { status: "DRAFT" },
      { status: "SCHEDULED" },
      { status: "PUBLISHED" },
      { status: "FAILED" },
    ]);
    assert.equal(c.draft, 1);
    assert.equal(c.scheduled, 1);
    assert.equal(c.published, 1);
    assert.equal(c.failed, 1);
  });

  it("flags at_risk when failed posts and no published", () => {
    assert.equal(
      assessKpiHealth({
        campaignStatus: "DRAFT",
        postCounts: { draft: 1, scheduled: 0, published: 0, failed: 2 },
        hasBentleyPayload: true,
        launchReadinessApproved: false,
      }),
      "at_risk"
    );
  });

  it("includes post-launch notes when published", () => {
    const snap = buildRevenueOsKpiSnapshot({
      campaignStatus: "ACTIVE",
      posts: [{ status: "PUBLISHED" }],
      hasBentleyPayload: true,
      launchReadinessApproved: true,
      daysSinceUpdate: 3,
    });
    assert.ok(snap.postLaunchNotes.some((n) => /Post-launch/i.test(n)));
  });
});

describe("launch readiness", () => {
  it("detects missing campaign and bentley payload blockers", () => {
    const blockers = detectLaunchBlockers({
      hasCampaign: false,
      hasBentleyPayload: false,
      campaignStatus: null,
      postCounts: { draft: 0, scheduled: 0, published: 0, failed: 0 },
      ownerReviewStatus: null,
      pipelineStage: "fulfillment_queued",
      launchReadinessApprovedAt: null,
      pendingLaunchApproval: false,
      websiteOrderReleased: null,
      trustOrderAtOwnerReview: null,
    });
    assert.ok(blockers.some((b) => /campaign/i.test(b)));
    assert.ok(blockers.some((b) => /Bentley/i.test(b)));
  });

  it("does not mark ready without launch checkpoint", () => {
    const lr = buildLaunchReadinessAssessment({
      hasCampaign: true,
      hasBentleyPayload: true,
      campaignStatus: "DRAFT",
      postCounts: { draft: 2, scheduled: 0, published: 0, failed: 0 },
      ownerReviewStatus: "approved",
      pipelineStage: "owner_review",
      launchReadinessApprovedAt: null,
      pendingLaunchApproval: false,
      websiteOrderReleased: null,
      trustOrderAtOwnerReview: null,
      launchApprovalId: null,
      launchApprovalStatus: "none",
    });
    assert.equal(lr.ready, false);
  });
});

describe("revision intelligence", () => {
  it("classifies recurring revisions", () => {
    assert.equal(
      classifyRevisionPattern({
        revisionRound: 4,
        draftVersion: 5,
        ownerReviewStatus: "pending",
        clientDeliveryStatus: "not_sent",
        pipelineStage: "owner_review",
        daysInCurrentStage: 3,
      }),
      "recurring_revisions"
    );
  });

  it("summarizes revision loop for skipper", () => {
    const r = buildRevisionIntelligence({
      revisionRound: 1,
      draftVersion: 2,
      ownerReviewStatus: "rejected",
      clientDeliveryStatus: "client_revision_requested",
      pipelineStage: "service_drafting",
      daysInCurrentStage: 2,
    });
    assert.match(r.summary, /revision/i);
  });
});

describe("orchestration integration", () => {
  it("includes REVENUE_OS in fulfillment departments", () => {
    assert.ok(FULFILLMENT_ORCHESTRATION_DEPARTMENTS.includes("REVENUE_OS"));
  });

  it("resolves revenue_os subject workspace", () => {
    const scope = resolveSubjectWorkspace({ subjectId: "revenue_os" });
    assert.equal(scope.workspaceKind, "revenue_os");
    assert.equal(scope.department, "REVENUE_OS");
  });

  it("registers revenue os write actions", () => {
    assert.ok(isWriteAction("createRevenueOsCampaignReviewPacket"));
    assert.ok(isWriteAction("recordRevenueOsLaunchReadinessCheckpoint"));
    assert.equal(WRITE_ACTION_NAMES.length, 14);
  });

  it("picker selects getExecutiveRevenueOsFulfillment for launch blocker prompts", () => {
    const tools = pickExecutiveReadTools("What launch blockers affect stalled campaigns?", null);
    assert.ok(tools.includes("getExecutiveRevenueOsFulfillment"));
  });
});
