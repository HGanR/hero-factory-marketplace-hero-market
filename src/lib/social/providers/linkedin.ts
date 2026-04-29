import { linkedinAdapter } from "@/lib/social/adapters/linkedin";
import type { SocialAccount } from "@/lib/social/types";
import type { SocialConnectionSummary, SocialProvider, SocialPublishInput, SocialPublishResult } from "./types";

function trimErr(s: string, max = 400): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function normalizeLinkedInPublishError(err: unknown): string {
  if (err instanceof Error) return trimErr(err.message);
  return trimErr(String(err));
}

export const linkedinSocialProvider: SocialProvider = {
  key: "linkedin",

  normalizeError: normalizeLinkedInPublishError,

  async validateConnection(accessToken: string) {
    const res = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      return { ok: false, error: `LinkedIn userinfo failed (${res.status})` };
    }
    const j = (await res.json()) as { name?: string; sub?: string };
    const summary: SocialConnectionSummary = {
      provider: "linkedin",
      providerAccountId: j.sub ? String(j.sub) : null,
      displayName: j.name ? String(j.name) : null,
    };
    return { ok: true, summary };
  },

  async publish(input: SocialPublishInput): Promise<SocialPublishResult> {
    const account: SocialAccount = {
      id: "",
      userId: "",
      clientId: "",
      platform: "linkedin",
      authType: "OAUTH",
      accessToken: input.accessToken,
    };
    try {
      const r = await linkedinAdapter.publish(account, {
        caption: input.content,
        linkUrl: input.linkUrl,
      });
      return { ok: true, externalPostId: r.platformPostId };
    } catch (e) {
      return {
        ok: false,
        normalizedError: normalizeLinkedInPublishError(e),
        rawMessage: e instanceof Error ? e.message : String(e),
      };
    }
  },
};
