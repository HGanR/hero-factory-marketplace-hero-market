import { getAdapter } from "@/lib/social/adapters";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";
import type { SocialPlatform } from "@/lib/social/config";
import { deriveSocialAccountCapabilityFlags } from "@/lib/social/social-account-capability-flags";

export type SocialStudioPublishMode = "direct" | "manual_export" | "mixed";

export function resolveSocialStudioPublishMode(args: {
  targetPlatforms: string[];
  connectedPlatforms: Set<SocialPlatform>;
}): { mode: SocialStudioPublishMode; lines: string[] } {
  const lines: string[] = [];
  const direct: string[] = [];
  const manual: string[] = [];

  for (const raw of args.targetPlatforms) {
    const p = normalizeAccountPlatformToSocialPlatform(raw);
    if (!p) {
      manual.push(`${raw} (unknown) → manual export only`);
      continue;
    }
    const adapter = getAdapter(p);
    const connected = args.connectedPlatforms.has(p);
    const { flags, directOrganicPublishAvailable } = deriveSocialAccountCapabilityFlags(p, null);
    if (!connected) {
      manual.push(`${p}: not connected — attach OAuth or use export package`);
      continue;
    }
    if (!adapter || !directOrganicPublishAvailable) {
      manual.push(
        `${p}: connected, but in-app direct publish ${
          adapter ? "is limited for this content type" : "is not implemented"
        } — use export or native app`
      );
      continue;
    }
    if (flags.canPublishText || flags.canPublishImage) {
      direct.push(`${p}: publish-ready (subject to media URL rules for image/video)`);
    } else {
      manual.push(`${p}: connected but no supported organic mode in-app`);
    }
  }

  if (direct.length && manual.length) {
    lines.push("Mixed mode: some targets can use the governed composer; others need manual export.");
  } else if (direct.length) {
    lines.push("Direct mode: you can create `campaign_posts` and schedule or publish from Revenue OS (subject to approval gates).");
  } else {
    lines.push("Manual publishing mode: download assets, copy captions, and post in each native app.");
  }
  lines.push(...direct, ...manual);

  const mode: SocialStudioPublishMode = direct.length && manual.length ? "mixed" : direct.length ? "direct" : "manual_export";
  return { mode, lines };
}

/**
 * Deterministic operator hints (no extra LLM): pick a connected account + mode for Social Studio → governed post.
 */
export function recommendBentleySocialStudioPromote(args: {
  targetPlatforms: string[];
  connectedAccounts: { id: string; platform: string; displayName?: string | null }[];
}): {
  recommendedPlatform: string | null;
  accountId: string | null;
  postMode: "draft" | "schedule" | "publish_now";
  lines: string[];
} {
  const lines: string[] = [];
  for (const acc of args.connectedAccounts) {
    const p = normalizeAccountPlatformToSocialPlatform(acc.platform);
    if (!p) continue;
    if (!getAdapter(p)) {
      lines.push(`${acc.platform}: no in-app adapter — use draft + manual export.`);
      continue;
    }
    if (args.targetPlatforms.some((t) => normalizeAccountPlatformToSocialPlatform(t) === p)) {
      return {
        recommendedPlatform: p,
        accountId: acc.id,
        postMode: "schedule",
        lines: [
          `Using connected ${p} account ${acc.displayName?.trim() || acc.id}.`,
          "Schedule is safer than instant publish for review — adjust in Social Studio if needed.",
        ],
      };
    }
  }
  const firstT = args.targetPlatforms.map((t) => normalizeAccountPlatformToSocialPlatform(t)).find(Boolean);
  if (firstT) {
    lines.push(`No ${firstT} connection found — start with a governed draft and export, or connect OAuth.`);
  }
  return { recommendedPlatform: null, accountId: null, postMode: "draft", lines };
}

/**
 * Lightweight, deterministic operator copy for Social Studio (guidance only — no new orchestration).
 */
export function buildSocialStudioOperatorGuidance(args: {
  /** e.g. `linkedin` when OAuth-backed + adapter for organic publish is available */
  bestDirectPlatform: string | null;
  /** image has public HTTPS (Pinata) — matters for Meta/IG in-app */
  hasHostedImageUrl: boolean;
  targetIncludesMetaFamily: boolean;
  /** From session or env in promote flow */
  publishApprovalLikely: boolean;
  hasAnyOauthConnection: boolean;
}): string[] {
  const o: string[] = [];
  if (args.hasAnyOauthConnection && args.bestDirectPlatform) {
    o.push(
      `${args.bestDirectPlatform} is the strongest in-app direct-publish path available right now (subject to media + governance).`
    );
  } else {
    o.push("No in-app direct-publish account matches yet — use governed draft and export, or connect OAuth in Connected Accounts.");
  }
  if (args.targetIncludesMetaFamily && !args.hasHostedImageUrl) {
    o.push("Instagram / Facebook: hosted HTTPS media is required for reliable in-app image publish; draft + export still works.");
  }
  if (args.publishApprovalLikely) {
    o.push("This session can require publish approval before publish-now or scheduled auto-publish — use draft when in doubt.");
  }
  if (!args.hasAnyOauthConnection) {
    o.push("No OAuth on this client — export package is the recommended handoff to native apps.");
  }
  return o;
}
