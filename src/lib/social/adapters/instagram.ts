/**
 * Instagram Graph API content publishing adapter.
 * Requires: Facebook Page + Instagram Business/Creator account linked.
 * Flow: Create container (media) → (video: wait for processing) → Publish container.
 * See: https://developers.facebook.com/docs/instagram-platform/content-publishing
 */
import type { SocialAccount, SocialAdapter, PublishInput, PublishResult } from "../types";

function trimErr(s: string, max = 400): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function normalizeInstagramPublishError(err: unknown): string {
  if (err instanceof Error) return trimErr(err.message);
  return trimErr(String(err));
}

function creativeUpper(t: string | null | undefined): string {
  return String(t ?? "")
    .trim()
    .toUpperCase();
}

/**
 * Video containers must reach FINISHED before `media_publish`.
 * @see https://developers.facebook.com/docs/instagram-api/reference/ig-container
 */
async function waitForInstagramContainerReady(containerId: string, accessToken: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  let last: string | null = null;
  while (Date.now() < deadline) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(containerId)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
    );
    const j = (await res.json()) as { status_code?: string; error?: { message?: string } };
    if (!res.ok) {
      const msg = j.error?.message ?? (await res.text());
      throw new Error(`Instagram container status failed (${res.status}): ${msg}`);
    }
    const code = j.status_code ?? "";
    last = code;
    if (code === "FINISHED") return;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram media container ${code.toLowerCase()} — try another video or check format/hosting.`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    `Instagram video container timed out waiting for processing (last status: ${last ?? "unknown"}).`
  );
}

async function getIgUserId(
  accessToken: string,
  pageId?: string | null
): Promise<string> {
  if (pageId) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`
    );
    if (res.ok) {
      const j = (await res.json()) as { instagram_business_account?: { id: string } };
      const igId = j.instagram_business_account?.id;
      if (igId) return igId;
    }
  }
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=instagram_business_account&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error("Failed to get Instagram account");
  const j = (await res.json()) as { data?: Array<{ id: string; instagram_business_account?: { id: string } }> };
  const page = j.data?.[0];
  const igId = page?.instagram_business_account?.id;
  if (!igId) throw new Error("No Instagram Business account linked");
  return igId;
}

export const instagramAdapter: SocialAdapter = {
  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    const igUserId = await getIgUserId(
      account.accessToken,
      account.externalAccountId
    );

    let mediaId: string | null = null;

    const fullCaption = [
      input.linkUrl ? `${input.caption}\n\n${input.linkUrl}` : input.caption,
      input.hashtags?.length ? input.hashtags.join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    if (input.assetUrl) {
      const ct = creativeUpper(input.assetCreativeType);
      if (ct === "TEXT" || ct === "LINK") {
        throw new Error(
          "Instagram publishing requires a campaign asset of type IMAGE or VIDEO, not TEXT/LINK."
        );
      }
      const isVideo = ct === "VIDEO";

      const params = new URLSearchParams({
        access_token: account.accessToken,
        caption: fullCaption,
      });

      if (isVideo) {
        params.set("media_type", "VIDEO");
        params.set("video_url", input.assetUrl);
      } else {
        params.set("image_url", input.assetUrl);
      }

      const containerRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      if (!containerRes.ok) {
        const err = await containerRes.text();
        throw new Error(`Instagram container failed: ${containerRes.status} ${err}`);
      }
      const cj = (await containerRes.json()) as { id?: string };
      mediaId = cj.id ?? null;
      if (!mediaId) throw new Error("No media container ID");

      if (isVideo) {
        await waitForInstagramContainerReady(mediaId, account.accessToken);
      }
    }

    if (mediaId) {
      const publishRes = await fetch(
        `https://graph.facebook.com/v21.0/${igUserId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            creation_id: mediaId,
            access_token: account.accessToken,
          }),
        }
      );
      if (!publishRes.ok) {
        const err = await publishRes.text();
        throw new Error(`Instagram publish failed: ${publishRes.status} ${err}`);
      }
      const pj = (await publishRes.json()) as { id?: string };
      const postId = pj.id;
      if (!postId) throw new Error("No Instagram post ID");
      return { platformPostId: postId };
    }

    throw new Error(
      "Instagram Content Publishing requires an image or video (campaign asset). Text-only posts are not supported by the API."
    );
  },
};
