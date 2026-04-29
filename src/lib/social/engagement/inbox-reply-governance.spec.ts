import { describe, expect, it, afterEach } from "@jest/globals";
import {
  inboxReplyApprovalRequiredForClient,
  resolveInboxReplyGovernance,
  threadMetadataForcesReplyApproval,
} from "./inbox-reply-governance";
import type { SocialEngagementCapabilities } from "./social-engagement-capabilities";
import type { SocialAccountCapabilityFlags } from "@/lib/social/social-account-capability-flags";

const baseFlags: SocialAccountCapabilityFlags = {
  canPublishText: true,
  canPublishImage: false,
  canPublishCarousel: false,
  canPublishVideo: false,
  canSchedule: false,
  canReadComments: true,
  canReplyComments: true,
  canReadDMs: true,
  canSendDMs: false,
  canFetchAnalytics: false,
};

function cap(over: Partial<SocialEngagementCapabilities> = {}): SocialEngagementCapabilities {
  return {
    canReadComments: true,
    canReplyComments: true,
    canReadDMs: true,
    canSendDMs: false,
    canReadMentions: true,
    canAutoRespond: false,
    requiresManualForReplies: false,
    reasons: [],
    baseFlags,
    ...over,
  };
}

describe("inbox-reply-governance", () => {
  const prevApproval = process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL;
  const prevBlock = process.env.REVENUE_OS_INBOX_BLOCK_REPLIES;
  const prevClients = process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS;

  afterEach(() => {
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL = prevApproval;
    process.env.REVENUE_OS_INBOX_BLOCK_REPLIES = prevBlock;
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS = prevClients;
  });

  it("resolves manual_only for non-comment source types", () => {
    const g = resolveInboxReplyGovernance({
      thread: { clientId: "c1", sourceType: "dm", metadataJson: null },
      sourceType: "dm",
      capabilities: cap(),
      hasAccessToken: true,
      hasGraphParent: true,
    });
    expect(g.effectiveActorMode).toBe("manual_only");
    expect(g.canReplyNow).toBe(false);
  });

  it("queues approval when env requires client", () => {
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL = "0";
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS = "c1,other";
    const g = resolveInboxReplyGovernance({
      thread: { clientId: "c1", sourceType: "comment", metadataJson: null },
      sourceType: "comment",
      capabilities: cap(),
      hasAccessToken: true,
      hasGraphParent: true,
    });
    expect(g.effectiveActorMode).toBe("approval_queue");
    expect(g.requiresApproval).toBe(true);
    expect(g.canReplyNow).toBe(false);
  });

  it("resolves direct when token + parent and no approval", () => {
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL = "0";
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS = "";
    const g = resolveInboxReplyGovernance({
      thread: { clientId: "c1", sourceType: "comment", metadataJson: null },
      sourceType: "comment",
      capabilities: cap(),
      hasAccessToken: true,
      hasGraphParent: true,
    });
    expect(g.effectiveActorMode).toBe("direct");
    expect(g.canReplyNow).toBe(true);
  });

  it("thread metadata can force approval", () => {
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL = "0";
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS = "";
    expect(
      threadMetadataForcesReplyApproval({ inboxGovernance: { requireReplyApproval: true } })
    ).toBe(true);
    const g = resolveInboxReplyGovernance({
      thread: {
        clientId: "c1",
        sourceType: "comment",
        metadataJson: { inboxGovernance: { requireReplyApproval: true } },
      },
      sourceType: "comment",
      capabilities: cap(),
      hasAccessToken: true,
      hasGraphParent: true,
    });
    expect(g.effectiveActorMode).toBe("approval_queue");
  });

  it("inboxReplyApprovalRequiredForClient reads env", () => {
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL = "1";
    expect(inboxReplyApprovalRequiredForClient("any")).toBe(true);
  });
});
