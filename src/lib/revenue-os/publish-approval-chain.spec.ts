import {
  clampAwaitingChainStepIndex,
  isMultiStepPublishApprovalChain,
  parseCampaignPublishApprovalChainJson,
  requiredReviewerRoleForChainStep,
} from "@/lib/revenue-os/publish-approval-chain";

describe("parseCampaignPublishApprovalChainJson", () => {
  it("returns null for empty or invalid", () => {
    expect(parseCampaignPublishApprovalChainJson(null)).toBeNull();
    expect(parseCampaignPublishApprovalChainJson({})).toBeNull();
    expect(parseCampaignPublishApprovalChainJson({ steps: [] })).toBeNull();
  });

  it("normalizes ordered steps", () => {
    const c = parseCampaignPublishApprovalChainJson({
      steps: [
        { stepIndex: 1, requiredReviewerRole: "approver" },
        { stepIndex: 0, requiredReviewerRole: "editor" },
      ],
    });
    expect(c?.steps.map((s) => s.requiredReviewerRole)).toEqual(["editor", "approver"]);
    expect(isMultiStepPublishApprovalChain(c)).toBe(true);
  });

  it("rejects non-contiguous stepIndex", () => {
    expect(
      parseCampaignPublishApprovalChainJson({
        steps: [
          { stepIndex: 0, requiredReviewerRole: "editor" },
          { stepIndex: 2, requiredReviewerRole: "approver" },
        ],
      })
    ).toBeNull();
  });
});

describe("clampAwaitingChainStepIndex", () => {
  const chain = parseCampaignPublishApprovalChainJson({
    steps: [
      { stepIndex: 0, requiredReviewerRole: "editor" },
      { stepIndex: 1, requiredReviewerRole: "approver" },
    ],
  })!;

  it("defaults to 0 when utm step missing", () => {
    expect(clampAwaitingChainStepIndex(chain, null)).toBe(0);
  });

  it("clamps to last step", () => {
    expect(clampAwaitingChainStepIndex(chain, 99)).toBe(1);
  });
});

describe("requiredReviewerRoleForChainStep", () => {
  it("returns role for step", () => {
    const chain = parseCampaignPublishApprovalChainJson({
      steps: [
        { stepIndex: 0, requiredReviewerRole: "editor" },
        { stepIndex: 1, requiredReviewerRole: "owner" },
      ],
    })!;
    expect(requiredReviewerRoleForChainStep(chain, 1)).toBe("owner");
  });
});
