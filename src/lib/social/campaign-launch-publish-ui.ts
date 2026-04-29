/**
 * Shared launch/publish UI rules: adapter availability, API error copy, token freshness hints.
 */

import type { SocialPlatform } from "@/lib/social/config";
import { getAdapter } from "@/lib/social/adapters";
import { postingPlatformDisplayName } from "@/lib/revenue-os/bentley-posting-platforms";

/** True when our server can call a real social adapter for this platform (OAuth connect may still be required). */
export function isAutomatedOAuthPublishSupported(platform: SocialPlatform | null | undefined): boolean {
  if (!platform) return false;
  return getAdapter(platform) != null;
}

/** OAuth token end time is in the past — refresh/reconnect recommended before publishing. */
export function socialAccountTokenLikelyExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt?.trim()) return false;
  const t = new Date(expiresAt).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export type PublishApiErrorBody = {
  error?: string;
  message?: string;
  code?: string;
};

/**
 * Maps POST /api/campaigns/posts/:id/publish JSON + status to concise UI copy.
 * Keeps server `message` when no friendlier mapping exists.
 */
export function userFacingMessageForPublishApiFailure(
  status: number,
  body: PublishApiErrorBody,
  platformHint?: SocialPlatform | null
): string {
  const code = typeof body.code === "string" ? body.code : "";
  const err = typeof body.error === "string" ? body.error : "";
  const msg = typeof body.message === "string" ? body.message.trim() : "";

  if (status === 409 && err === "IN_PROGRESS") {
    return "Publishing is already in progress for this post. Wait a few seconds and try again.";
  }
  if (status === 400 && err === "ALREADY_POSTED") {
    return "This post is already published.";
  }
  if (status === 400 && err === "INVALID_STATUS") {
    return "This post can’t be published from its current status. Refresh the page, or contact support if it looks stuck.";
  }
  if (status === 401) {
    return "Sign in again, then retry publish.";
  }
  if (code === "ACCOUNT_NOT_CONNECTED") {
    const label = platformHint ? postingPlatformDisplayName(platformHint) : "this network";
    return `No OAuth account linked for ${label}. Connect ${label} below, then try again.`;
  }
  if (code === "PLATFORM_UNSUPPORTED") {
    return "Automated publish is not available for this network yet. Copy your caption and post in the native app, or use the API instructions panel for your client.";
  }
  if (code === "INVALID_PLATFORM") {
    return "This post’s platform is not recognized for publish. Recreate the draft or contact support.";
  }
  if (msg) return msg;
  if (status >= 500) {
    return "The publish service had a problem. Try again in a moment, or reconnect the account if this persists.";
  }
  return "Could not publish. Check the message above or reconnect your account.";
}
