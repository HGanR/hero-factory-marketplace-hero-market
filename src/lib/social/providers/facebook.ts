import { facebookAdapter, normalizeFacebookPublishError } from "@/lib/social/adapters/facebook";
import type { SocialAccount } from "@/lib/social/types";
import type { SocialConnectionSummary, SocialProvider, SocialPublishInput, SocialPublishResult } from "./types";

export const facebookSocialProvider: SocialProvider = {
  key: "facebook",

  normalizeError: normalizeFacebookPublishError,

  async validateConnection(accessToken: string) {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) {
      return { ok: false, error: `Facebook token check failed (${res.status})` };
    }
    const j = (await res.json()) as { id?: string; name?: string };
    const summary: SocialConnectionSummary = {
      provider: "facebook",
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
      platform: "facebook",
      authType: "OAUTH",
      accessToken: input.accessToken,
    };
    try {
      const r = await facebookAdapter.publish(account, {
        caption: input.content,
        linkUrl: input.linkUrl,
      });
      return { ok: true, externalPostId: r.platformPostId };
    } catch (e) {
      return {
        ok: false,
        normalizedError: normalizeFacebookPublishError(e),
        rawMessage: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
