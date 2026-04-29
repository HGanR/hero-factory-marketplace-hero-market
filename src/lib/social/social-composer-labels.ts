import {
  defaultSocialAccountLabelForPlatform,
  isGovernedSocialPublishPlatform,
  type GovernedSocialPublishPlatform,
} from "@/lib/social/social-governed-platforms";

export type ComposerAccountListRow = {
  id: string;
  platform: string;
  displayName: string | null;
  externalAccountId: string | null;
};

/**
 * Human-readable option label for the governed composer account picker (Meta Pages, IG, LinkedIn).
 */
export function formatComposerSocialAccountLabel(row: ComposerAccountListRow): string {
  const platform = String(row.platform || "").toLowerCase();
  const baseName = (row.displayName || "").trim();
  const ext = row.externalAccountId?.trim();

  if (platform === "facebook") {
    const page = baseName || "Facebook Page";
    return ext ? `${page} (Page ${ext})` : `${page} (Page id not stored — reconnect if publish fails)`;
  }
  if (platform === "instagram") {
    const ig = baseName || "Instagram";
    return ext
      ? `${ig} (Facebook Page ${ext} → IG Business)`
      : `${ig} (no Page id — reconnect with a Page linked to Instagram Business)`;
  }
  if (platform === "linkedin") {
    return baseName || defaultSocialAccountLabelForPlatform("linkedin");
  }
  return baseName || defaultSocialAccountLabelForPlatform(platform) || row.id;
}

export function governedProviderLabel(p: GovernedSocialPublishPlatform): string {
  return defaultSocialAccountLabelForPlatform(p);
}

/** Label for `campaign_posts.platform` / list row `provider` (unknown values fall back). */
export function labelForStoredPostProvider(platform: string): string {
  const s = platform.trim().toLowerCase();
  if (isGovernedSocialPublishPlatform(s)) return governedProviderLabel(s);
  return defaultSocialAccountLabelForPlatform(s);
}
