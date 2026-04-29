/**
 * Background-safe entry: publish one campaign post via LinkedIn using stored connection + caption.
 */

import type { CampaignPostPublishContext } from "@/lib/social/campaign-post-publish";
import { createSocialProvider } from "@/lib/social/providers";

export type PublishLinkedinScheduledPostResult =
  | { ok: true; externalPostId: string }
  | { ok: false; normalizedError: string };

/**
 * Executes LinkedIn publish for a loaded {@link CampaignPostPublishContext} (scheduled worker / internal jobs).
 */
export async function publishLinkedinScheduledPost(
  ctx: CampaignPostPublishContext
): Promise<PublishLinkedinScheduledPostResult> {
  if (ctx.platformKey !== "linkedin") {
    return { ok: false, normalizedError: "NOT_LINKEDIN_POST" };
  }
  const provider = createSocialProvider("linkedin");
  if (!provider) {
    return { ok: false, normalizedError: "LINKEDIN_PROVIDER_UNAVAILABLE" };
  }
  const r = await provider.publish({
    accessToken: ctx.accessToken,
    content: ctx.post.caption ?? "",
    linkUrl: ctx.finalLink,
  });
  if (r.ok) return { ok: true, externalPostId: r.externalPostId };
  return { ok: false, normalizedError: r.normalizedError };
}
