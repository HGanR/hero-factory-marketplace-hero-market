import { describe, it, expect } from "@jest/globals";
import { seedGovernanceUtmForNewSocialPost } from "@/lib/social/social-post-approval-seed";
import {
  BENTLEY_UTM_APPROVAL_STATUS,
  BENTLEY_UTM_APPROVAL_CHAIN_TOTAL,
} from "@/lib/revenue-os/publish-approval-utm";

describe("seedGovernanceUtmForNewSocialPost", () => {
  const actor = {
    userId: 1 as number | null,
    label: "tester",
    role: "operator" as const,
    identityBacked: true,
  };
  const nowIso = "2026-04-08T12:00:00.000Z";

  it("sets not_required when approval is off", () => {
    const utm = seedGovernanceUtmForNewSocialPost({
      requireApproval: false,
      campaignPublishApprovalChainJson: null,
      actor,
      nowIso,
    });
    expect(utm[BENTLEY_UTM_APPROVAL_STATUS]).toBe("not_required");
  });

  it("sets pending_approval when approval is on (no chain)", () => {
    const utm = seedGovernanceUtmForNewSocialPost({
      requireApproval: true,
      campaignPublishApprovalChainJson: null,
      actor,
      nowIso,
    });
    expect(utm[BENTLEY_UTM_APPROVAL_STATUS]).toBe("pending_approval");
  });

  it("seeds multi-step chain keys when chain is configured", () => {
    const utm = seedGovernanceUtmForNewSocialPost({
      requireApproval: true,
      campaignPublishApprovalChainJson: {
        steps: [
          { stepIndex: 0, requiredReviewerRole: "editor" },
          { stepIndex: 1, requiredReviewerRole: "approver" },
        ],
      },
      actor,
      nowIso,
    });
    expect(utm[BENTLEY_UTM_APPROVAL_STATUS]).toBe("pending_approval");
    expect(utm[BENTLEY_UTM_APPROVAL_CHAIN_TOTAL]).toBe("2");
  });
});
