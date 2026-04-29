import type { SocialAccountRow } from "@/lib/db/schema";
import { deriveSocialAccountCapabilityFlags, type SocialAccountCapabilityFlags } from "@/lib/social/social-account-capability-flags";

export type SocialEngagementSourceType = "comment" | "dm" | "mention" | "reply" | "ad_comment" | "unknown";

export type SocialEngagementCapabilities = {
  canReadComments: boolean;
  canReplyComments: boolean;
  canReadDMs: boolean;
  canSendDMs: boolean;
  canReadMentions: boolean;
  canAutoRespond: boolean;
  /** For `sourceType`, whether in-app reply is unsupported (use native / copy). */
  requiresManualForReplies: boolean;
  reasons: string[];
  baseFlags: SocialAccountCapabilityFlags;
};

type FlagsOverride = Partial<SocialAccountCapabilityFlags> & { canReadMentions?: boolean } | null | undefined;

/**
 * Single source of truth for engagement UI, ingestion, and Bentley. Uses `deriveSocialAccountCapabilityFlags` + explicit rules.
 */
export function resolveSocialEngagementCapabilities(args: {
  provider: string;
  flagsOverride: FlagsOverride;
  socialAccount: SocialAccountRow | null;
  sourceType?: SocialEngagementSourceType;
}): SocialEngagementCapabilities {
  const platform = args.socialAccount?.platform ?? args.provider;
  const { flags, notes } = deriveSocialAccountCapabilityFlags(platform, args.flagsOverride ?? undefined);
  const o = args.flagsOverride ?? {};
  const canReadMentions = Boolean((o as { canReadMentions?: boolean }).canReadMentions);
  const reasons: string[] = [...notes];
  if (!args.socialAccount) {
    reasons.push("No connected account — engage via native app only until OAuth is linked.");
  }
  if (!canReadMentions) {
    reasons.push("Mention streams are not live-synced in this product version unless flagged in account capabilities.");
  }
  reasons.push("Autonomous auto-respond is disabled — all sends require a human (or a future policy engine).");

  const st = args.sourceType ?? "unknown";
  let requiresManualForReplies = true;
  if (st === "comment" || st === "reply" || st === "ad_comment") {
    requiresManualForReplies = !flags.canReplyComments;
    if (requiresManualForReplies) reasons.push("In-app comment reply is not available for this account — use the native app.");
  } else if (st === "dm") {
    requiresManualForReplies = !flags.canSendDMs;
    if (requiresManualForReplies) reasons.push("In-app DM send is not available — use native DM or a copy/paste handoff.");
  } else if (st === "mention") {
    requiresManualForReplies = !canReadMentions || !flags.canReplyComments;
    if (requiresManualForReplies) reasons.push("Mention handling is manual in this build.");
  } else {
    // Account summary / thread without precise type: manual if we have no reply path at all
    requiresManualForReplies = !flags.canReplyComments && !flags.canSendDMs;
  }

  if (args.socialAccount?.expiresAt) {
    const ex = new Date(args.socialAccount.expiresAt);
    if (!Number.isNaN(ex.getTime()) && ex.getTime() < Date.now()) {
      requiresManualForReplies = true;
      reasons.push("OAuth token expired — reconnect the account.");
    }
  }

  return {
    canReadComments: flags.canReadComments,
    canReplyComments: flags.canReplyComments,
    canReadDMs: flags.canReadDMs,
    canSendDMs: flags.canSendDMs,
    canReadMentions,
    canAutoRespond: false,
    requiresManualForReplies,
    reasons: [...new Set(reasons)],
    baseFlags: flags,
  };
}
