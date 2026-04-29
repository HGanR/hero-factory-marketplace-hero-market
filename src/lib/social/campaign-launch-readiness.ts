/**
 * Pure helpers for Bentley Campaign Launch readiness summaries and post-row copy.
 */

import type { SocialPlatform } from "@/lib/social/config";
import type { CampaignLaunchPlatformRow } from "@/lib/revenue-os/bentley-launch-prefill";
import { postingPlatformDisplayName } from "@/lib/revenue-os/bentley-posting-platforms";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";
import type { SocialAccountLite } from "@/lib/social/social-account-public";
import {
  isAutomatedOAuthPublishSupported,
  socialAccountTokenLikelyExpired,
} from "@/lib/social/campaign-launch-publish-ui";

export type LaunchTargetsReadiness = {
  selectedCount: number;
  publishReadyCount: number;
  reconnectRequiredCount: number;
  manualOnlyCount: number;
  connectRequiredCount: number;
};

function accountForPostingPlatform(
  accounts: SocialAccountLite[],
  plat: SocialPlatform
): SocialAccountLite | undefined {
  return accounts.find(
    (a) => (a.platformCanonical ?? normalizeAccountPlatformToSocialPlatform(a.platform)) === plat
  );
}

/** Readiness across OAuth posting targets (same scope as connect / API rows). */
export function computeLaunchTargetsReadiness(
  platformRows: readonly Pick<CampaignLaunchPlatformRow, "key">[],
  accounts: SocialAccountLite[],
  connectedPlatforms: Set<SocialPlatform>
): LaunchTargetsReadiness {
  let publishReadyCount = 0;
  let reconnectRequiredCount = 0;
  let manualOnlyCount = 0;
  let connectRequiredCount = 0;

  for (const row of platformRows) {
    const key = row.key;
    if (!isAutomatedOAuthPublishSupported(key)) {
      manualOnlyCount++;
      continue;
    }
    const acct = accountForPostingPlatform(accounts, key);
    const connected = connectedPlatforms.has(key);
    const stale = acct ? socialAccountTokenLikelyExpired(acct.expiresAt) : false;
    if (connected && stale) reconnectRequiredCount++;
    else if (!connected) connectRequiredCount++;
    else publishReadyCount++;
  }

  return {
    selectedCount: platformRows.length,
    publishReadyCount,
    reconnectRequiredCount,
    manualOnlyCount,
    connectRequiredCount,
  };
}

const PUBLISHABLE = new Set(["DRAFT", "SCHEDULED", "FAILED", "RETRY_SCHEDULED"]);

export type CampaignPostLaunchPresentation = {
  /** Short badge for the row (operator scan). */
  launchBadge: string;
  /** One line: server vs manual. */
  serverPublishLine: string;
  /** What to do next. */
  nextActionLine: string;
  /** Shown when publish is not offered or is blocked. */
  publishAvailabilityNote?: string;
};

function serverPublishAvailabilityLine(automated: boolean): string {
  return automated ? "Server publish: on (OAuth)" : "Server publish: off — manual only";
}

/**
 * Per-post row copy for campaign posts list (launch section).
 * Aligns with POST /api/campaigns/posts/:id/publish rules (PUBLISHABLE statuses).
 */
export function getCampaignPostLaunchPresentation(args: {
  status: string;
  platformRaw: string;
  accounts: SocialAccountLite[];
  connectedPlatforms: Set<SocialPlatform>;
}): CampaignPostLaunchPresentation {
  const plat = normalizeAccountPlatformToSocialPlatform(args.platformRaw);
  const label = plat ? postingPlatformDisplayName(plat) : args.platformRaw || "Unknown";
  const automated = isAutomatedOAuthPublishSupported(plat);
  const acct = plat ? accountForPostingPlatform(args.accounts, plat) : undefined;
  const connected = Boolean(plat && args.connectedPlatforms.has(plat));
  const tokenStale = Boolean(plat && acct && socialAccountTokenLikelyExpired(acct.expiresAt));

  const st = String(args.status).toUpperCase();

  if (st === "POSTED") {
    return {
      launchBadge: "Published",
      serverPublishLine: serverPublishAvailabilityLine(automated),
      nextActionLine: "No further publish — already live.",
    };
  }

  if (st === "PUBLISHING") {
    return {
      launchBadge: "Publishing",
      serverPublishLine: serverPublishAvailabilityLine(automated),
      nextActionLine: "Wait — publish already running.",
      publishAvailabilityNote:
        "Another publish is in progress for this post. Wait a few seconds before retrying.",
    };
  }

  if (!PUBLISHABLE.has(st)) {
    return {
      launchBadge: postStatusShortLabel(st),
      serverPublishLine: serverPublishAvailabilityLine(automated),
      nextActionLine: "Cannot publish from this status.",
      publishAvailabilityNote:
        st === "CANCELLED" || st === "ARCHIVED"
          ? "This post is not in a publishable state. Open the campaign in the editor or create a new draft."
          : "Refresh the page or contact support if this looks wrong.",
    };
  }

  if (!automated) {
    return {
      launchBadge: "Manual only",
      serverPublishLine: serverPublishAvailabilityLine(false),
      nextActionLine: `Copy caption — post in ${label} or use panel 3 (API steps).`,
      publishAvailabilityNote: "Hero Factory cannot push to this network yet.",
    };
  }

  if (!plat) {
    return {
      launchBadge: "Unknown platform",
      serverPublishLine: serverPublishAvailabilityLine(false),
      nextActionLine: "Fix platform on the draft or recreate the post.",
      publishAvailabilityNote: "Platform value could not be matched for OAuth.",
    };
  }

  if (connected && tokenStale) {
    return {
      launchBadge: "Reconnect",
      serverPublishLine: serverPublishAvailabilityLine(true),
      nextActionLine: `Reconnect ${label} — access token likely expired.`,
      publishAvailabilityNote: "OAuth refresh required before server publish.",
    };
  }

  if (!connected) {
    return {
      launchBadge: "Connect",
      serverPublishLine: serverPublishAvailabilityLine(true),
      nextActionLine: `Connect ${label} to enable server publish.`,
      publishAvailabilityNote: "No linked account for this network yet.",
    };
  }

  const ready: CampaignPostLaunchPresentation = {
    launchBadge:
      st === "SCHEDULED"
        ? "Ready · scheduled"
        : st === "FAILED" || st === "RETRY_SCHEDULED"
          ? "Ready · retry"
          : "Ready",
    serverPublishLine: serverPublishAvailabilityLine(true),
    nextActionLine:
      st === "FAILED" || st === "RETRY_SCHEDULED"
        ? "Retry server publish."
        : st === "SCHEDULED"
          ? "Publish now or wait for the scheduled time."
          : "Publish now from Hero Factory.",
  };

  return ready;
}

function postStatusShortLabel(status: string): string {
  const s = String(status).toUpperCase();
  if (s === "SCHEDULED") return "Scheduled";
  if (s === "FAILED") return "Failed";
  if (s === "RETRY_SCHEDULED") return "Retry scheduled";
  if (s === "DRAFT") return "Draft";
  return status;
}
