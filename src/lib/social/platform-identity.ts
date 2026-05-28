/**
 * Central normalization: strategy labels, OAuth/posting IDs (`SocialPlatform`),
 * connected account `platform` strings, and Content Engine chip IDs.
 *
 * All matching is case-insensitive for free text; canonical IDs stay lowercase.
 */

import type { SocialPlatform } from "./config";

/** Content Engine / viral-content UI chips (includes YouTube; not necessarily OAuth-backed). */
export type ContentPlatformId =
  | "instagram"
  | "tiktok"
  | "x"
  | "linkedin"
  | "youtube"
  | "facebook";

export const CONTENT_PLATFORM_CHIP_IDS: readonly ContentPlatformId[] = [
  "instagram",
  "tiktok",
  "x",
  "linkedin",
  "youtube",
  "facebook",
] as const;

const EXACT_DISPLAY_LABEL_TO_CONTENT_ID: Record<string, ContentPlatformId> = {
  Instagram: "instagram",
  TikTok: "tiktok",
  "X (Twitter)": "x",
  Twitter: "x",
  LinkedIn: "linkedin",
  YouTube: "youtube",
  Facebook: "facebook",
  Other: "instagram",
};

const ALL_SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
  "pinterest",
  "snapchat",
  "x",
];

function isSocialPlatformString(s: string): s is SocialPlatform {
  return (ALL_SOCIAL_PLATFORMS as readonly string[]).includes(s);
}

/**
 * Map a strategy channel label or free-text segment to a Content Engine chip id.
 * Defaults to `instagram` when unknown (matches previous dashboard behavior).
 */
export function normalizeStrategyLabelToContentPlatformId(label: string): ContentPlatformId {
  const t = (typeof label === "string" ? label : String(label ?? "")).trim();
  if (!t) return "instagram";
  const exact = EXACT_DISPLAY_LABEL_TO_CONTENT_ID[t];
  if (exact) return exact;
  const low = t.toLowerCase();
  if (low.includes("instagram") || low === "ig") return "instagram";
  if (low.includes("tiktok") || low.includes("tik tok")) return "tiktok";
  if (low.includes("linkedin")) return "linkedin";
  if (low.includes("youtube")) return "youtube";
  if (low.includes("facebook") || low === "fb") return "facebook";
  if (low.includes("twitter") || low === "x" || low.includes("x.com")) return "x";
  return "instagram";
}

export function isContentPlatformChipId(id: string): id is ContentPlatformId {
  return (CONTENT_PLATFORM_CHIP_IDS as readonly string[]).includes(id);
}

/**
 * Map one strategy label to an OAuth-capable posting id, or null if no match.
 * (Does not map YouTube / generic “social” — same rules as legacy `mapLabelsToPostingPlatforms` per label.)
 */
export function normalizeStrategyLabelToOauthPostingPlatform(label: string): SocialPlatform | null {
  const low = (typeof label === "string" ? label : String(label ?? "")).trim().toLowerCase();
  if (!low) return null;
  if (low.includes("instagram") || low === "ig") return "instagram";
  if (low.includes("tiktok") || low.includes("tik tok")) return "tiktok";
  if (low.includes("linkedin")) return "linkedin";
  if (low.includes("facebook") || low === "fb") return "facebook";
  if (low.includes("pinterest")) return "pinterest";
  if (low.includes("snapchat") || low.includes("snap")) return "snapchat";
  return null;
}

/**
 * Normalize DB/API `social_accounts.platform` (or provider strings) to `SocialPlatform`.
 * Used for connection checks vs `postingPlatforms` and OAuth routes.
 */
export function normalizeAccountPlatformToSocialPlatform(
  raw: string | null | undefined | unknown
): SocialPlatform | null {
  const s = (typeof raw === "string" ? raw : String(raw ?? "")).trim().toLowerCase();
  if (!s) return null;
  if (isSocialPlatformString(s)) return s;
  if (s.includes("instagram") || s === "ig") return "instagram";
  if (s.includes("facebook") || s === "fb") return "facebook";
  if (s.includes("tiktok") || s.includes("tik tok")) return "tiktok";
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("pinterest")) return "pinterest";
  if (s.includes("snapchat") || s.includes("snap")) return "snapchat";
  if (s.includes("twitter") || s === "tweet" || /\bx\.com\b/.test(s)) return "x";
  return null;
}

/**
 * Platforms with working `/api/social/oauth/[platform]/...` routes (excludes `x` until wired).
 * Single source of truth for OAuth path validation and create-post `platform` enum.
 */
export const OAUTH_CONNECTABLE_PLATFORM_IDS = [
  "linkedin",
  "instagram",
  "facebook",
  "tiktok",
  "pinterest",
  "snapchat",
] as const satisfies readonly SocialPlatform[];

export type OauthConnectablePlatformId = (typeof OAUTH_CONNECTABLE_PLATFORM_IDS)[number];

export function isOauthConnectablePlatformId(p: string): p is OauthConnectablePlatformId {
  return (OAUTH_CONNECTABLE_PLATFORM_IDS as readonly string[]).includes(p);
}

/**
 * Parse `[platform]` segment for OAuth start/callback routes.
 * Returns canonical id only for {@link OAUTH_CONNECTABLE_PLATFORM_IDS}, else null (`x`, YouTube, unknown).
 */
export function parseOAuthRoutePlatformParam(raw: string | undefined): SocialPlatform | null {
  const n = normalizeAccountPlatformToSocialPlatform(
    typeof raw === "string" ? raw.trim() : String(raw ?? "").trim()
  );
  if (!n) return null;
  if (!isOauthConnectablePlatformId(n)) return null;
  return n;
}

/**
 * Values allowed in `social_accounts.platform` for OAuth-backed rows (Hero connect targets only).
 * Rejects `x`, YouTube, etc. — use before insert/update.
 */
export function normalizeSocialAccountPlatformForWrite(raw: string): SocialPlatform | null {
  const n = normalizeAccountPlatformToSocialPlatform(raw);
  if (!n || !isOauthConnectablePlatformId(n)) return null;
  return n;
}

/**
 * Canonical `campaign_posts.platform` for publish — same rules as stored social account ids.
 */
export function normalizeCampaignPostPlatformForPublish(raw: string | null | undefined): SocialPlatform | null {
  return normalizeAccountPlatformToSocialPlatform(raw);
}

/** For `z.enum([...])` on create-post APIs (Zod tuple requirement). */
export const ZOD_OAUTH_POSTING_PLATFORM_ENUM = OAUTH_CONNECTABLE_PLATFORM_IDS as unknown as [
  string,
  ...string[],
];

/**
 * Set of `SocialPlatform` values for which we have a connected account row (normalized).
 * Uses `platformCanonical` from GET /api/social/accounts when present; otherwise normalizes `platform`.
 */
export function connectedSocialPlatformsSet(
  accounts: { platform: string; platformCanonical?: SocialPlatform | null }[]
): Set<SocialPlatform> {
  const out = new Set<SocialPlatform>();
  for (const a of accounts) {
    const p = a.platformCanonical ?? normalizeAccountPlatformToSocialPlatform(a.platform);
    if (p) out.add(p);
  }
  return out;
}
