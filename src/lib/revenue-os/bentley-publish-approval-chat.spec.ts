import {
  formatApproveAllRedirectReply,
  formatPublishApprovalIntelligenceReply,
  isApproveAllFromChatIntent,
  isPublishApprovalFocusIntent,
} from "@/lib/revenue-os/bentley-publish-approval-chat";
import type { RevenueOsPublishWorkflowSummary } from "@/lib/revenue-os/publish-workflow-review-types";

const emptySummary = (): RevenueOsPublishWorkflowSummary => ({
  rows: [],
  counts: { draft: 0, scheduled: 0, published: 0, failed: 0 },
  blockers: [],
  readyToConfirm: true,
  sortBasis: "test",
});

describe("bentley-publish-approval-chat", () => {
  it("detects approve-all intent for redirect (no auto-approve)", () => {
    expect(isApproveAllFromChatIntent("approve all scheduled posts")).toBe(true);
    expect(isApproveAllFromChatIntent("approve everything")).toBe(true);
    expect(isApproveAllFromChatIntent("approve this row only")).toBe(false);
  });

  it("detects approval focus intents", () => {
    expect(isPublishApprovalFocusIntent("what is approved")).toBe(true);
    expect(isPublishApprovalFocusIntent("what still needs approval")).toBe(true);
    expect(isPublishApprovalFocusIntent("is anything ready for the worker")).toBe(true);
  });

  it("approve-all reply directs to panel", () => {
    const t = formatApproveAllRedirectReply();
    expect(t).toMatch(/not executed from chat/i);
    expect(t).toMatch(/Publish workflow review/i);
  });

  it("formatPublishApprovalIntelligenceReply matches summary counts", () => {
    const summary: RevenueOsPublishWorkflowSummary = {
      ...emptySummary(),
      rows: [
        {
          postId: "a",
          platform: "instagram",
          title: "",
          bodyPreview: "x",
          status: "scheduled",
          approvalStatus: "pending_approval",
          eligibleForWorker: false,
        },
        {
          postId: "b",
          platform: "linkedin",
          title: "",
          bodyPreview: "y",
          status: "scheduled",
          approvalStatus: "approved",
          eligibleForWorker: true,
          approvalDecidedByUserId: 42,
          approvalDecidedByLabel: "Ada",
          approvalActorRole: "owner",
          hasApprovalIdentity: true,
        },
      ],
    };
    const reply = formatPublishApprovalIntelligenceReply({
      summary,
      effectiveApprovalRequired: true,
      userMessage: "what still needs approval",
    });
    expect(reply).toMatch(/pending \*\*1\*\*/);
    expect(reply).toMatch(/approved \*\*1\*\*/);
    expect(reply).toMatch(/worker-eligible rows 1/);
    expect(reply).toMatch(/Governance:/);
    expect(reply).toMatch(/persisted approver user id/);
  });

  it("who approved lists identity when available", () => {
    const summary: RevenueOsPublishWorkflowSummary = {
      ...emptySummary(),
      rows: [
        {
          postId: "b",
          platform: "linkedin",
          title: "",
          bodyPreview: "y",
          status: "scheduled",
          approvalStatus: "approved",
          eligibleForWorker: true,
          approvalDecidedByUserId: 7,
          approvalDecidedByLabel: "Bob",
          hasApprovalIdentity: true,
        },
      ],
    };
    const reply = formatPublishApprovalIntelligenceReply({
      summary,
      effectiveApprovalRequired: true,
      userMessage: "who approved this",
    });
    expect(reply).toMatch(/Bob/);
    expect(reply).toMatch(/id 7/);
  });

  it("distinguishes label-only when user id missing", () => {
    const summary: RevenueOsPublishWorkflowSummary = {
      ...emptySummary(),
      rows: [
        {
          postId: "b",
          platform: "linkedin",
          title: "",
          bodyPreview: "y",
          status: "scheduled",
          approvalStatus: "approved",
          eligibleForWorker: true,
          approvalDecidedByLabel: "SessionLabel",
          hasApprovalIdentity: false,
          approvalIdentitySessionOnly: true,
        },
      ],
    };
    const reply = formatPublishApprovalIntelligenceReply({
      summary,
      effectiveApprovalRequired: true,
      userMessage: "who approved this",
    });
    expect(reply).toMatch(/user id not recorded/);
  });
});
