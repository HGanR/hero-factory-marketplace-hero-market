/**
 * LinkedIn UGC Post adapter (POST /v2/ugcPosts).
 * See: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
 */
import type { SocialAccount, SocialAdapter, PublishInput, PublishResult } from "../types";

async function getPersonUrn(accessToken: string): Promise<string> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to get LinkedIn user info");
  const j = (await res.json()) as { sub?: string };
  const sub = j.sub;
  if (!sub) throw new Error("No LinkedIn person URN");
  return `urn:li:person:${sub}`;
}

export const linkedinAdapter: SocialAdapter = {
  async publish(account: SocialAccount, input: PublishInput): Promise<PublishResult> {
    const author = await getPersonUrn(account.accessToken);
    const text = [
      input.caption,
      input.hashtags?.length ? input.hashtags.join(" ") : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    let shareMediaCategory: "NONE" | "ARTICLE" | "IMAGE" = "NONE";
    let media: unknown[] = [];

    if (input.linkUrl) {
      shareMediaCategory = "ARTICLE";
      media = [
        {
          status: "READY",
          originalUrl: input.linkUrl,
          title: { text: input.caption.slice(0, 200) },
          description: { text: input.caption.slice(0, 256) },
        },
      ];
    }
    // TODO: IMAGE support requires registerUpload → upload binary → use asset URN

    const body = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory,
          ...(media.length > 0 && { media }),
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" as const,
      },
    };

    const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${account.accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LinkedIn publish failed: ${res.status} ${err}`);
    }

    const postId = res.headers.get("X-RestLi-Id") || "";
    if (!postId) throw new Error("LinkedIn did not return post ID");
    return { platformPostId: postId };
  },
};
