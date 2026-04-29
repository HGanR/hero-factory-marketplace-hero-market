import type { SocialEngagementSourceType } from "./social-engagement-capabilities";
import type { SocialEngagementCapabilities } from "./social-engagement-capabilities";

export type InboxReplyGovernance = {
  canReplyNow: boolean;
  requiresApproval: boolean;
  reason: string;
  /** direct = Graph may run immediately; approval_queue = save as note / pending; manual_only = native/copy */
  effectiveActorMode: "direct" | "approval_queue" | "manual_only";
};

const COMMENT: SocialEngagementSourceType[] = ["comment", "reply", "ad_comment"];

export function inboxReplyApprovalRequiredForClient(clientId: string): boolean {
  if (process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL === "1") {
    return true;
  }
  const list = (process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 && list.includes(clientId);
}

/** Thread metadata: `{ "inboxGovernance": { "requireReplyApproval": true } }` */
export function threadMetadataForcesReplyApproval(metadataJson: unknown): boolean {
  if (!metadataJson || typeof metadataJson !== "object") {
    return false;
  }
  const o = metadataJson as Record<string, unknown>;
  const g = o.inboxGovernance;
  return Boolean(g && typeof g === "object" && (g as { requireReplyApproval?: unknown }).requireReplyApproval === true);
}

/**
 * Single truth for reply button + approval policy. Does not call Graph; used by API + thread detail.
 */
export function resolveInboxReplyGovernance(args: {
  thread: { clientId: string; sourceType: string; metadataJson: unknown };
  sourceType: SocialEngagementSourceType;
  capabilities: SocialEngagementCapabilities;
  hasAccessToken: boolean;
  hasGraphParent: boolean;
}): InboxReplyGovernance {
  const st = args.sourceType;
  if (!COMMENT.includes(st as SocialEngagementSourceType)) {
    return {
      canReplyNow: false,
      requiresApproval: false,
      reason: "In-app comment reply applies only to comment / reply / ad_comment threads — use native tools for DMs or other types.",
      effectiveActorMode: "manual_only",
    };
  }
  if (process.env.REVENUE_OS_INBOX_BLOCK_REPLIES === "1") {
    return {
      canReplyNow: false,
      requiresApproval: false,
      reason: "Inbox replies are disabled (REVENUE_OS_INBOX_BLOCK_REPLIES).",
      effectiveActorMode: "manual_only",
    };
  }
  if (!args.capabilities.canReplyComments) {
    return {
      canReplyNow: false,
      requiresApproval: false,
      reason: args.capabilities.reasons[0] ?? "Account cannot reply to comments in-app.",
      effectiveActorMode: "manual_only",
    };
  }
  if (args.capabilities.requiresManualForReplies) {
    return {
      canReplyNow: false,
      requiresApproval: false,
      reason: args.capabilities.reasons[0] ?? "Capability layer requires a manual path.",
      effectiveActorMode: "manual_only",
    };
  }
  if (inboxReplyApprovalRequiredForClient(String(args.thread.clientId)) || threadMetadataForcesReplyApproval(args.thread.metadataJson)) {
    return {
      canReplyNow: false,
      requiresApproval: true,
      reason: inboxReplyApprovalRequiredForClient(String(args.thread.clientId))
        ? "Client is configured to require an approval step before a Graph send — your draft is saved as a note; nothing auto-posts."
        : "This thread is flagged to require reply approval before sending from the inbox — your draft is saved as a note.",
      effectiveActorMode: "approval_queue",
    };
  }
  if (!args.hasAccessToken) {
    return {
      canReplyNow: false,
      requiresApproval: false,
      reason: "No OAuth access token — reconnect the social account.",
      effectiveActorMode: "manual_only",
    };
  }
  if (!args.hasGraphParent) {
    return {
      canReplyNow: false,
      requiresApproval: false,
      reason: "Missing `graphParentCommentId` in thread metadata (ingest must supply it for Graph).",
      effectiveActorMode: "manual_only",
    };
  }
  return {
    canReplyNow: true,
    requiresApproval: false,
    reason: "Operator-authorized in-app send to Graph; audited on success.",
    effectiveActorMode: "direct",
  };
}
