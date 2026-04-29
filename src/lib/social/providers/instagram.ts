import { instagramAdapter } from "@/lib/social/adapters/instagram";
import { normalizeInstagramPublishError } from "@/lib/social/adapters/instagram";
import type { SocialAccount } from "@/lib/social/types";
import type { SocialConnectionSummary, SocialProvider, SocialPublishInput, SocialPublishResult } from "./types";

export const instagramSocialProvider: SocialProvider = {
  key: "instagram",

  normalizeError: normalizeInstagramPublishError,

  async validateConnection(accessToken: string) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) {
      return { ok: false, error: `Instagram/Meta token check failed (${res.status})` };
    }
    const j = (await res.json()) as { id?: string; name?: string };
    const summary: SocialConnectionSummary = {
      provider: "instagram",
      providerAccountId: j.id ? String(j.id) : null,
      displayName: j.name ? String(j.name) : null,
    };
    return { ok: true, summary };
  },

  async publish(input: SocialPublishInput): Promise<SocialPublishResult> {
    const account: SocialAccount = {
      id: "",
      userId: "",
      clientId: "",
      platform: "instagram",
      authType: "OAUTH",
      accessToken: input.accessToken,
    };
    try {
      const r = await instagramAdapter.publish(account, {
        caption: input.content,
        linkUrl: input.linkUrl,
      });
      return { ok: true, externalPostId: r.platformPostId };
    } catch (e) {
      return {
        ok: false,
        normalizedError: normalizeInstagramPublishError(e),
        rawMessage: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
