/**
 * OAuth config for supported platforms.
 * Env vars: LINKEDIN_*, META_* (Instagram/Facebook), TIKTOK_*, PINTEREST_*, SNAPCHAT_*
 */

export type SocialPlatform = "linkedin" | "instagram" | "facebook" | "tiktok" | "pinterest" | "snapchat" | "x";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const PLATFORM_CONFIG: Record<
  SocialPlatform,
  {
    enabled: boolean;
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientIdKey: string;
    clientSecretKey: string;
    /** TikTok uses client_key in auth/token; others use client_id */
    useClientKey?: boolean;
  }
> = {
  linkedin: {
    enabled: !!process.env.LINKEDIN_CLIENT_ID && !!process.env.LINKEDIN_CLIENT_SECRET,
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    scopes: ["openid", "profile", "w_member_social"],
    clientIdKey: "LINKEDIN_CLIENT_ID",
    clientSecretKey: "LINKEDIN_CLIENT_SECRET",
  },
  instagram: {
    // Meta: use Facebook Login, then exchange for Instagram token
    enabled: !!process.env.META_APP_ID && !!process.env.META_APP_SECRET,
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: [
      "instagram_business_basic",
      "instagram_content_publish",
      "instagram_manage_insights",
      "pages_show_list",
      "pages_read_engagement",
    ],
    clientIdKey: "META_APP_ID",
    clientSecretKey: "META_APP_SECRET",
  },
  facebook: {
    enabled: !!process.env.META_APP_ID && !!process.env.META_APP_SECRET,
    authUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    scopes: ["pages_manage_posts", "pages_show_list", "pages_read_engagement"],
    clientIdKey: "META_APP_ID",
    clientSecretKey: "META_APP_SECRET",
  },
  tiktok: {
    enabled: !!process.env.TIKTOK_CLIENT_KEY && !!process.env.TIKTOK_CLIENT_SECRET,
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "video.publish", "video.list"],
    clientIdKey: "TIKTOK_CLIENT_KEY",
    clientSecretKey: "TIKTOK_CLIENT_SECRET",
    useClientKey: true,
  },
  pinterest: {
    enabled: !!process.env.PINTEREST_APP_ID && !!process.env.PINTEREST_APP_SECRET,
    authUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    scopes: ["user_accounts:read", "boards:read", "pins:read", "pins:write"],
    clientIdKey: "PINTEREST_APP_ID",
    clientSecretKey: "PINTEREST_APP_SECRET",
  },
  snapchat: {
    enabled: !!process.env.SNAPCHAT_CLIENT_ID && !!process.env.SNAPCHAT_CLIENT_SECRET,
    authUrl: "https://accounts.snapchat.com/login/oauth2/authorize",
    tokenUrl: "https://accounts.snapchat.com/login/oauth2/access_token",
    scopes: ["snapchat-marketing-api", "snapchat-profile-api"],
    clientIdKey: "SNAPCHAT_CLIENT_ID",
    clientSecretKey: "SNAPCHAT_CLIENT_SECRET",
  },
  x: {
    enabled: false, // TODO: add X_CLIENT_ID, X_CLIENT_SECRET
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    clientIdKey: "X_CLIENT_ID",
    clientSecretKey: "X_CLIENT_SECRET",
  },
};

/**
 * OAuth redirect URI registered with the provider. Default: `/api/social/oauth/{platform}/callback`.
 * Optional `LINKEDIN_OAUTH_REDIRECT_URI` full URL for apps that register `/api/social/linkedin/callback` instead.
 */
export function getRedirectUri(platform: SocialPlatform): string {
  if (platform === "linkedin") {
    const override = process.env.LINKEDIN_OAUTH_REDIRECT_URI?.trim();
    if (override) return override;
  }
  return `${BASE_URL}/api/social/oauth/${platform}/callback`;
}

export function getClientId(platform: SocialPlatform): string | null {
  return process.env[PLATFORM_CONFIG[platform].clientIdKey] ?? null;
}

export function getClientSecret(platform: SocialPlatform): string | null {
  return process.env[PLATFORM_CONFIG[platform].clientSecretKey] ?? null;
}
