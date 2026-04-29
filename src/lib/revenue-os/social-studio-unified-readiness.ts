import type { SocialAccountRow } from "@/lib/db/schema";
import { connectedSocialPlatformsSet } from "@/lib/social/platform-identity";
import type { SocialPlatform } from "@/lib/social/config";
import { resolveSocialStudioPublishMode } from "@/lib/revenue-os/bentley-social-studio-hints";
import {
  resolveSocialStudioPromoteReadiness,
  type StudioPostMode,
} from "@/lib/revenue-os/social-studio-promote-readiness";

/**
 * Single capability + connection truth for Social Studio → `campaign_posts` (API and UI).
 * Wraps: `resolveSocialStudioPromoteReadiness` (media + adapters) and `resolveSocialStudioPublishMode` (OAuth coverage).
 */
export type StudioPublishReadiness = {
  canPublishNow: boolean;
  canSchedule: boolean;
  /** Export / native app path — in-app direct publish is not available */
  requiresManual: boolean;
  /** New posts use approval UTM when true (env + session on POST) */
  requiresApproval: boolean;
  /** Human-readable: connection, media, platform, or approval */
  reasons: string[];
  /** Provider/media/account detail */
  promote: ReturnType<typeof resolveSocialStudioPromoteReadiness>;
  /** Per-target “direct vs manual export” from connected OAuth set */
  publishMode: ReturnType<typeof resolveSocialStudioPublishMode>;
};

export function resolveStudioPublishReadiness(args: {
  targetPlatform: string;
  socialAccount: SocialAccountRow | null;
  postMode: StudioPostMode;
  scheduledAtIso: string | null;
  campaignAssetId: string | null;
  assetCreativeType: string | null;
  hasHostedHttpsAssetUrl: boolean;
  treatAsHasStorageUrlForValidation: boolean;
  /** `social_accounts` rows for this user+client (to build `connectedSocialPlatformsSet`) */
  connectedAccountRows: Array<{ platform: string; platformCanonical?: SocialPlatform | null }>;
  /** Effective approval for new post (matches `readEffectivePublishApprovalRequiredFromRequest` on promote) */
  governanceRequiresApproval: boolean;
}): StudioPublishReadiness {
  const promote = resolveSocialStudioPromoteReadiness({
    targetPlatform: args.targetPlatform,
    socialAccount: args.socialAccount,
    postMode: args.postMode,
    scheduledAtIso: args.scheduledAtIso,
    campaignAssetId: args.campaignAssetId,
    assetCreativeType: args.assetCreativeType,
    hasHostedHttpsAssetUrl: args.hasHostedHttpsAssetUrl,
    treatAsHasStorageUrlForValidation: args.treatAsHasStorageUrlForValidation,
  });

  const connected = connectedSocialPlatformsSet(args.connectedAccountRows);
  const publishMode = resolveSocialStudioPublishMode({
    targetPlatforms: [args.targetPlatform],
    connectedPlatforms: connected,
  });

  const reasons: string[] = [];
  for (const w of promote.warnings) {
    if (!reasons.includes(w)) reasons.push(w);
  }
  for (const line of publishMode.lines) {
    if (!reasons.includes(line)) reasons.push(line);
  }
  if (args.governanceRequiresApproval) {
    const r = "Approval is required for this post under current governance / session settings.";
    if (!reasons.includes(r)) reasons.push(r);
  }

  const requiresManual =
    promote.manualOnlyPlatform || publishMode.mode === "manual_export";

  return {
    canPublishNow: promote.publishNowReady,
    canSchedule: promote.scheduleReady,
    requiresManual,
    requiresApproval: args.governanceRequiresApproval,
    reasons,
    promote,
    publishMode,
  };
}
