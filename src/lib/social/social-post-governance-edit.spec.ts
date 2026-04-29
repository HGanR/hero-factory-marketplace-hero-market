import { describe, it, expect, afterEach } from "@jest/globals";
import {
  socialPostMaterialFieldsChanged,
  mergeUtmAfterSocialPostEdit,
  buildPublishReadinessMessage,
} from "@/lib/social/social-post-governance-edit";
import type { campaignPosts } from "@/lib/db/schema";

const actor = {
  userId: 9 as number | null,
  label: "u",
  role: "operator" as const,
  identityBacked: true,
};

describe("social-post-governance-edit", () => {
  afterEach(() => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "";
  });

  it("socialPostMaterialFieldsChanged detects caption change", () => {
    expect(
      socialPostMaterialFieldsChanged({
        prevCaption: "a",
        prevLinkUrl: null,
        prevSocialAccountId: null,
        prevScheduledAtIso: null,
        prevAssetId: null,
        nextCaption: "b",
      })
    ).toBe(true);
  });

  it("mergeUtmAfterSocialPostEdit resubmit moves rejected to pending when worker requires approval", () => {
    const prevUtm = {
      bentley_approval_status: "rejected",
      bentley_approval_reason: "fix tone",
    };
    const out = mergeUtmAfterSocialPostEdit({
      prevUtm,
      campaignPublishApprovalChainJson: null,
      actor,
      nowIso: "2026-06-01T12:00:00.000Z",
      workerRequiresApproval: true,
      resubmitForApproval: true,
      storedApprovalStatus: "rejected",
      materialChanged: false,
    });
    expect(out.approvalReset).toBe(true);
    expect(out.utmParams.bentley_approval_status).toBe("pending_approval");
  });

  it("mergeUtmAfterSocialPostEdit resubmit clears rejection with not_required when worker off", () => {
    const prevUtm = { bentley_approval_status: "rejected" };
    const out = mergeUtmAfterSocialPostEdit({
      prevUtm,
      campaignPublishApprovalChainJson: null,
      actor,
      nowIso: "2026-06-01T12:00:00.000Z",
      workerRequiresApproval: false,
      resubmitForApproval: true,
      storedApprovalStatus: "rejected",
      materialChanged: false,
    });
    expect(out.utmParams.bentley_approval_status).toBe("not_required");
  });

  it("mergeUtmAfterSocialPostEdit material edit on approved resets to pending when worker on", () => {
    process.env.BENTLEY_SCHEDULED_PUBLISH_REQUIRE_APPROVAL = "1";
    const prevUtm = { bentley_approval_status: "approved" };
    const out = mergeUtmAfterSocialPostEdit({
      prevUtm,
      campaignPublishApprovalChainJson: null,
      actor,
      nowIso: "2026-06-01T12:00:00.000Z",
      workerRequiresApproval: true,
      resubmitForApproval: false,
      storedApprovalStatus: "approved",
      materialChanged: true,
    });
    expect(out.utmParams.bentley_approval_status).toBe("pending_approval");
  });

  it("buildPublishReadinessMessage for rejected", () => {
    const post = {
      status: "DRAFT",
      utmParams: { bentley_approval_status: "rejected" },
      scheduledAt: null,
      postedAt: null,
    } as typeof campaignPosts.$inferSelect;
    expect(buildPublishReadinessMessage({ post, workerRequiresApproval: true })).toContain("Rejected");
  });
});
