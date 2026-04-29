import { describe, it, expect, afterEach } from "@jest/globals";
import type { campaignPosts } from "@/lib/db/schema";
import {
  buildApprovalChainSummaryLabel,
  buildSocialPostActivityTimeline,
  deriveSocialPostBlockedDiagnostics,
  mapAuditRowToTimelineEntry,
} from "@/lib/social/social-publish-observability";

function post(partial: Partial<typeof campaignPosts.$inferSelect>): typeof campaignPosts.$inferSelect {
  return {
    id: "p1",
    campaignId: "c1",
    platform: "linkedin",
    assetId: null,
    scheduledAt: null,
    status: "DRAFT",
    caption: "Hello",
    hashtags: null,
    linkUrl: null,
    utmParams: {},
    scheduledPublishMeta: null,
    platformPostId: null,
    errorMessage: null,
    socialAccountId: "acc1",
    postedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    ...partial,
  } as typeof campaignPosts.$inferSelect;
}

describe("social-publish-observability", () => {
  const prev = process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL;

  afterEach(() => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = prev;
  });

  it("deriveSocialPostBlockedDiagnostics: awaiting_approval when scheduled and gate blocks", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({
        status: "SCHEDULED",
        scheduledAt: new Date("2026-06-01T12:00:00.000Z"),
        utmParams: { bentley_approval_status: "pending_approval", bentley_approval_step_started_at: "2026-05-01T12:00:00.000Z" },
      }),
      workerRequiresApproval: true,
      now: new Date("2026-05-02T12:00:00.000Z"),
    });
    expect(d.blockedReasonCode).toBe("awaiting_approval");
    expect(d.nextActionHint).toBeTruthy();
  });

  it("deriveSocialPostBlockedDiagnostics: approval_overdue", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({
        status: "SCHEDULED",
        scheduledAt: new Date("2026-06-01T12:00:00.000Z"),
        utmParams: {
          bentley_approval_status: "pending_approval",
          bentley_approval_step_started_at: "2026-01-01T12:00:00.000Z",
        },
      }),
      workerRequiresApproval: true,
      now: new Date("2026-01-10T12:00:00.000Z"),
    });
    expect(d.blockedReasonCode).toBe("approval_overdue");
  });

  it("deriveSocialPostBlockedDiagnostics: rejected_needs_resubmit", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({
        utmParams: { bentley_approval_status: "rejected", bentley_approval_reason: "Tone" },
      }),
      workerRequiresApproval: true,
    });
    expect(d.blockedReasonCode).toBe("rejected_needs_resubmit");
    expect(d.diagnostics).toContain("Tone");
  });

  it("deriveSocialPostBlockedDiagnostics: missing_account on scheduled row", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({
        status: "SCHEDULED",
        scheduledAt: new Date("2026-06-01T12:00:00.000Z"),
        socialAccountId: null,
        utmParams: { bentley_approval_status: "approved" },
      }),
      workerRequiresApproval: false,
    });
    expect(d.blockedReasonCode).toBe("missing_account");
  });

  it("deriveSocialPostBlockedDiagnostics: missing_content", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({ caption: "   " }),
      workerRequiresApproval: false,
    });
    expect(d.blockedReasonCode).toBe("missing_content");
  });

  it("deriveSocialPostBlockedDiagnostics: instagram_requires_media without asset", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({
        platform: "instagram",
        assetId: null,
        caption: "Caption only",
      }),
      workerRequiresApproval: false,
    });
    expect(d.blockedReasonCode).toBe("instagram_requires_media");
    expect(d.blockedReason).toMatch(/image|video/i);
  });

  it("deriveSocialPostBlockedDiagnostics: provider_media_incompatible for TEXT asset on Instagram", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({
        platform: "instagram",
        assetId: "asset-1",
        caption: "Hi",
      }),
      workerRequiresApproval: false,
      linkedAssetCreativeType: "TEXT",
    });
    expect(d.blockedReasonCode).toBe("provider_media_incompatible");
  });

  it("deriveSocialPostBlockedDiagnostics: missing_schedule for draft with copy", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({ status: "DRAFT", caption: "OK", scheduledAt: null }),
      workerRequiresApproval: false,
    });
    expect(d.blockedReasonCode).toBe("missing_schedule");
  });

  it("deriveSocialPostBlockedDiagnostics: publish_failed_retryable for RETRY_SCHEDULED", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({ status: "RETRY_SCHEDULED", scheduledAt: new Date("2026-06-01T12:00:00.000Z") }),
      workerRequiresApproval: false,
    });
    expect(d.blockedReasonCode).toBe("publish_failed_retryable");
  });

  it("deriveSocialPostBlockedDiagnostics: published_read_only", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
    const d = deriveSocialPostBlockedDiagnostics({
      post: post({ status: "POSTED", postedAt: new Date() }),
      workerRequiresApproval: false,
    });
    expect(d.blockedReasonCode).toBe("published_read_only");
    expect(d.publishedOrPublishing).toBe(true);
  });

  it("mapAuditRowToTimelineEntry maps scheduled_publish_retry_scheduled", () => {
    const e = mapAuditRowToTimelineEntry({
      id: "a1",
      action: "scheduled_publish_retry_scheduled",
      platform: "linkedin",
      details: { nextPublishAttemptAt: "2026-06-02T12:00:00.000Z" },
      createdAt: "2026-06-01T12:00:00.000Z",
    });
    expect(e.kind).toBe("retry_scheduled");
    expect(e.label).toContain("Retry");
  });

  it("mapAuditRowToTimelineEntry maps publish_approval_approved intermediate chain", () => {
    const e = mapAuditRowToTimelineEntry({
      id: "a2",
      action: "publish_approval_approved",
      platform: "linkedin",
      details: { chainCompleted: false, approvalStepIndex: 0, decidedByLabel: "Sam" },
      createdAt: "2026-06-01T12:00:00.000Z",
    });
    expect(e.kind).toBe("approval_step_advanced");
    expect(e.label).toContain("step");
  });

  it("mapAuditRowToTimelineEntry maps external_review_link_minted", () => {
    const e = mapAuditRowToTimelineEntry({
      id: "m1",
      action: "external_review_link_minted",
      platform: "ext_review",
      details: {
        label: "Round A",
        expiresAt: "2026-08-01T00:00:00.000Z",
        allowedRoles: ["approver", "editor"],
      },
      createdAt: "2026-06-01T12:00:00.000Z",
    });
    expect(e.label).toContain("Client review link created");
    expect(e.label).toContain("Round A");
    expect(e.detail).toContain("approver");
  });

  it("mapAuditRowToTimelineEntry maps external_review_link_revoked", () => {
    const e = mapAuditRowToTimelineEntry({
      id: "r1",
      action: "external_review_link_revoked",
      platform: "ext_review",
      details: { label: "Old", tokenId: "abc-def-ghi" },
      createdAt: "2026-06-02T12:00:00.000Z",
    });
    expect(e.label).toContain("revoked");
    expect(e.label).toContain("Old");
  });

  it("mapAuditRowToTimelineEntry maps external_review_link_email_sent", () => {
    const e = mapAuditRowToTimelineEntry({
      id: "e1",
      action: "external_review_link_email_sent",
      platform: "ext_review",
      details: { subject: "Hello there" },
      createdAt: "2026-06-02T12:00:00.000Z",
    });
    expect(e.label).toContain("emailed");
  });

  it("mapAuditRowToTimelineEntry maps external_review_links_bulk_revoked", () => {
    const e = mapAuditRowToTimelineEntry({
      id: "b1",
      action: "external_review_links_bulk_revoked",
      platform: "ext_review",
      details: { revokedCount: 3, mode: "all_active" },
      createdAt: "2026-06-02T12:00:00.000Z",
    });
    expect(e.label).toContain("bulk revoked");
    expect(e.detail).toContain("3");
    expect(e.detail).toContain("all active");
  });

  it("mapAuditRowToTimelineEntry appends client review hint for external_social_review", () => {
    const approved = mapAuditRowToTimelineEntry({
      id: "a-ext-ok",
      action: "publish_approval_approved",
      platform: "linkedin",
      details: {
        chainCompleted: true,
        decidedByLabel: "Client",
        reviewSurface: "external_social_review",
      },
      createdAt: "2026-06-01T12:00:00.000Z",
    });
    expect(approved.label).toContain("client review link");

    const rejected = mapAuditRowToTimelineEntry({
      id: "a-ext-no",
      action: "publish_approval_rejected",
      platform: "linkedin",
      details: { decidedByLabel: "Client", reviewSurface: "external_social_review" },
      createdAt: "2026-06-01T12:00:00.000Z",
    });
    expect(rejected.label).toContain("client review link");
  });

  it("buildSocialPostActivityTimeline is newest_first", () => {
    const tl = buildSocialPostActivityTimeline({
      post: post({ createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      auditRows: [
        {
          id: "old",
          action: "publish_approval_pending",
          platform: "linkedin",
          details: {},
          createdAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "new",
          action: "scheduled_publish_attempted",
          platform: "linkedin",
          details: {},
          createdAt: "2026-06-10T00:00:00.000Z",
        },
      ],
    });
    expect(tl[0].rawAction).toBe("scheduled_publish_attempted");
  });

  it("buildApprovalChainSummaryLabel multi-step pending", () => {
    const s = buildApprovalChainSummaryLabel({
      totalSteps: 3,
      currentStepIndex: 1,
      requiredRole: "approver",
      effectiveStatus: "pending_approval",
    });
    expect(s).toContain("Step 2 of 3");
    expect(s.toLowerCase()).toContain("approver");
  });

  it("mapAuditRowToTimelineEntry maps social PATCH audit actions", () => {
    const content = mapAuditRowToTimelineEntry({
      id: "c1",
      action: "content_changed",
      platform: "linkedin",
      details: { prevCaptionLength: 2, nextCaptionLength: 10, source: "social_patch" },
      createdAt: "2026-06-15T12:00:00.000Z",
    });
    expect(content.kind).toBe("content_changed");
    expect(content.label).toBe("Content updated");

    const resub = mapAuditRowToTimelineEntry({
      id: "r1",
      action: "resubmitted_for_approval",
      platform: "linkedin",
      details: { changedFields: ["content"], source: "social_patch" },
      createdAt: "2026-06-15T12:00:01.000Z",
    });
    expect(resub.kind).toBe("resubmitted");
    expect(resub.label).toBe("Resubmitted for approval");
  });

  it("PATCH-style batch appears newest_first when createdAt increases", () => {
    const tl = buildSocialPostActivityTimeline({
      post: post({ createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      auditRows: [
        {
          id: "first",
          action: "content_changed",
          platform: "linkedin",
          details: { prevCaptionLength: 1, nextCaptionLength: 2 },
          createdAt: "2026-06-20T12:00:00.000Z",
        },
        {
          id: "second",
          action: "resubmitted_for_approval",
          platform: "linkedin",
          details: {},
          createdAt: "2026-06-20T12:00:02.000Z",
        },
      ],
    });
    expect(tl[0].rawAction).toBe("resubmitted_for_approval");
  });
});
