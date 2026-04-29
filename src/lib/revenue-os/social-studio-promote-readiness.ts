import { getAdapter } from "@/lib/social/adapters";
import { isGovernedSocialPublishPlatform } from "@/lib/social/social-governed-platforms";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";
import { deriveSocialAccountCapabilityFlags } from "@/lib/social/social-account-capability-flags";
import { validateComposerSocialPostMedia } from "@/lib/social/social-post-create-rules";
import type { SocialAccountRow } from "@/lib/db/schema";

export type StudioPostMode = "draft" | "schedule" | "publish_now";

export type SocialStudioPromoteReadiness = {
  targetPlatform: string;
  /** Governed adapter platforms (LI/FB/IG) only */
  adapterPublishSupported: boolean;
  /** TikTok / X / etc. — draft + manual only */
  manualOnlyPlatform: boolean;
  hasAccount: boolean;
  accountMatchesPlatform: boolean;
  directPublishReady: boolean;
  scheduleReady: boolean;
  publishNowReady: boolean;
  /** When media validation would block schedule/publish */
  mediaBlocked: boolean;
  mediaMessage: string | null;
  warnings: string[];
};

function platformNorm(p: string): string {
  return String(p || "")
    .trim()
    .toLowerCase();
}

export function resolveSocialStudioPromoteReadiness(args: {
  targetPlatform: string;
  socialAccount: SocialAccountRow | null;
  postMode: StudioPostMode;
  /** ISO for scheduled publish validation (Instagram media rules) */
  scheduledAtIso?: string | null;
  campaignAssetId: string | null;
  assetCreativeType: string | null;
  hasHostedHttpsAssetUrl: boolean;
  /** When false, data URL or missing — treat as no URL for FB/IG rules */
  treatAsHasStorageUrlForValidation: boolean;
}): SocialStudioPromoteReadiness {
  const targetPlatform = platformNorm(args.targetPlatform);
  const warnings: string[] = [];
  const canonical = normalizeAccountPlatformToSocialPlatform(targetPlatform);
  const manualOnlyPlatform = canonical ? !isGovernedSocialPublishPlatform(canonical) : true;
  const adapter = canonical ? getAdapter(canonical) : null;
  const adapterPublishSupported = Boolean(adapter) && !manualOnlyPlatform;

  const hasAccount = Boolean(args.socialAccount);
  const accountPlat = args.socialAccount
    ? normalizeAccountPlatformToSocialPlatform(args.socialAccount.platform)
    : null;
  const accountMatchesPlatform = Boolean(
    accountPlat && canonical && accountPlat === canonical
  );

  let mediaMessage: string | null = null;
  const scheduledFor =
    args.postMode === "schedule" && args.scheduledAtIso?.trim()
      ? args.scheduledAtIso.trim()
      : null;
  const mediaVal = validateComposerSocialPostMedia({
    provider: targetPlatform,
    scheduledFor,
    assetId: args.campaignAssetId,
    assetCreativeType: args.assetCreativeType,
    hasStorageUrl: args.treatAsHasStorageUrlForValidation && args.hasHostedHttpsAssetUrl,
  });
  const mediaBlocked = !mediaVal.ok;
  if (!mediaVal.ok) {
    mediaMessage = mediaVal.message;
  }

  let directPublishReady = false;
  if (adapterPublishSupported && accountMatchesPlatform && args.socialAccount) {
    const d = deriveSocialAccountCapabilityFlags(args.socialAccount.platform, null);
    directPublishReady = d.directOrganicPublishAvailable && !mediaBlocked;
    if (!d.flags.canPublishText && !d.flags.canPublishImage && !d.flags.canPublishVideo) {
      directPublishReady = false;
      warnings.push("This platform has no supported organic publish mode in-app.");
    }
  }
  if (manualOnlyPlatform) {
    directPublishReady = false;
    warnings.push("This network is not available for in-app direct publish — save as draft or export manually.");
  }
  if (!hasAccount) {
    warnings.push("No social account selected — save as draft or connect OAuth.");
  } else if (!accountMatchesPlatform) {
    warnings.push("Selected account does not match destination platform.");
  }
  if (!args.hasHostedHttpsAssetUrl && (targetPlatform === "instagram" || targetPlatform === "facebook")) {
    if (args.campaignAssetId) {
      warnings.push("Image must be a hosted HTTPS URL for reliable Meta/IG publish.");
    }
  }

  const canScheduleThisMedia =
    adapterPublishSupported && accountMatchesPlatform && !mediaBlocked;
  const scheduleReady = canScheduleThisMedia;

  const publishNowReady =
    adapterPublishSupported && accountMatchesPlatform && !mediaBlocked && directPublishReady;

  return {
    targetPlatform,
    adapterPublishSupported,
    manualOnlyPlatform,
    hasAccount,
    accountMatchesPlatform,
    directPublishReady,
    scheduleReady,
    publishNowReady,
    mediaBlocked,
    mediaMessage,
    warnings,
  };
}
