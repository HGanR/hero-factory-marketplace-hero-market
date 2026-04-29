/**
 * Facebook Graph API — Page feed posts and optional Page photo posts.
 * `social_accounts.external_account_id` must be the Facebook Page id.
 */
import type { SocialAccount, SocialAdapter, PublishInput, PublishResult } from "../types";

function trimErr(s: string, max = 400): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function normalizeFacebookPublishError(err: unknown): string {
  if (err instanceof Error) return trimErr(err.message);
  return trimErr(String(err));
}

function creativeUpper(t: string | null | undefined): string {
  return String(t ?? "")
    .trim()
    .toUpperCase();
}

export const facebookAdapter: SocialAdapter = {
  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    const pageId = account.externalAccountId?.trim();
    if (!pageId) {
      throw new Error(
        "Facebook Page is not linked to this connection. Reconnect Facebook in Revenue OS so we can store your Page."
      );
    }

    const message = (input.caption ?? "").trim() || (input.linkUrl ? "" : " ");
    const link = input.linkUrl?.trim();
    const ct = creativeUpper(input.assetCreativeType);
    const imageUrl = input.assetUrl?.trim();

    if (imageUrl) {
      if (ct === "VIDEO") {
        throw new Error(
          "Facebook Page video posts are not supported in Revenue OS yet. Use an IMAGE asset or publish text/link only."
        );
      }
      if (ct && ct !== "IMAGE") {
        throw new Error(`Facebook photo publish requires an IMAGE campaign asset (got ${ct}).`);
      }
      const caption = [message, link].filter(Boolean).join("\n\n") || " ";
      const params = new URLSearchParams({
        url: imageUrl,
        published: "true",
        access_token: account.accessToken,
        caption: caption.length > 2000 ? `${caption.slice(0, 1997)}…` : caption,
      });
      const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Facebook photo publish failed (${res.status}): ${text}`);
      }
      const j = (await res.json()) as { id?: string; post_id?: string };
      const postId = j.post_id ?? j.id;
      if (!postId) throw new Error("Facebook did not return a photo post id");
      return { platformPostId: String(postId) };
    }

    const params = new URLSearchParams({
      access_token: account.accessToken,
      message: message || " ",
    });
    if (link) {
      params.append("link", link);
    }

    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Facebook publish failed (${res.status}): ${text}`);
    }

    const j = (await res.json()) as { id?: string; post_id?: string };
    const postId = j.post_id ?? j.id;
    if (!postId) throw new Error("Facebook did not return a post id");
    return { platformPostId: String(postId) };
  },
};
