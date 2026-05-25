/**
 * Pure helpers for Bentley → campaign_posts planning (testable without DB).
 */

import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import { BENTLEY_PLATFORM_POST_KEYS } from "@/lib/revenue-os/campaign-schema";
import { normalizeCampaignPostPlatformForPublish } from "@/lib/social/platform-identity";
import { isOauthConnectablePlatformId } from "@/lib/social/platform-identity";
import type { SocialPlatform } from "@/lib/social/config";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

export const BENTLEY_UTM_UNIT_KEY = "bentley_unit_key";
/** Traces optimization variant posts back to `bentley_optimization_runs.id` (idempotency + lineage). */
export const BENTLEY_UTM_OPTIMIZATION_RUN_ID = "bentley_optimization_run_id";

export type ScheduleStrategy = "immediate" | "staggered";

const LABEL_HINT: Record<string, SocialPlatform> = {
  instagram: "instagram",
  tiktok: "tiktok",
  linkedin: "linkedin",
  facebook: "facebook",
  pinterest: "pinterest",
  snapchat: "snapchat",
  youtube: "linkedin",
  twitter: "instagram",
  x: "instagram",
};

/** Prefer OAuth-connectable platforms so campaign_posts.platform passes create-post validation. */
export function resolveOauthPlatformsForBentleyLaunch(input: {
  postingPlatforms?: string[] | null;
  contentPlatforms?: string[] | null;
}): SocialPlatform[] {
  const out: SocialPlatform[] = [];
  const tryAdd = (raw: string) => {
    const n = normalizeCampaignPostPlatformForPublish(coerceTrimmedString(raw));
    if (n && isOauthConnectablePlatformId(n) && !out.includes(n)) out.push(n);
  };
  for (const p of input.postingPlatforms ?? []) {
    tryAdd(String(p));
  }
  if (out.length) return out;
  for (const label of input.contentPlatforms ?? []) {
    const low = coerceTrimmedString(label).toLowerCase();
    const hint = LABEL_HINT[low] ?? normalizeCampaignPostPlatformForPublish(label);
    if (hint && isOauthConnectablePlatformId(hint) && !out.includes(hint)) out.push(hint);
  }
  if (out.length) return out;
  return ["instagram"];
}

/** Deterministic 32-char id (FNV-style); safe in browser + Node — matches across retries. */
export function buildBentleyUnitKey(campaignId: string, platform: string, slot: number): string {
  const raw = `${campaignId}|${platform.toLowerCase()}|${slot}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hi = (h >>> 0).toString(16).padStart(8, "0");
  let h2 = raw.length * 31;
  for (let i = 0; i < raw.length; i++) h2 = (Math.imul(h2, 31) + raw.charCodeAt(i)) | 0;
  const lo = (h2 >>> 0).toString(16).padStart(8, "0");
  return (hi + lo).slice(0, 32);
}

export function collectBentleyUnitKeysFromPosts(
  posts: { utmParams?: unknown }[]
): Set<string> {
  const s = new Set<string>();
  for (const p of posts) {
    const u = p.utmParams as Record<string, string> | null | undefined;
    const k = coerceTrimmedString(u?.[BENTLEY_UTM_UNIT_KEY]);
    if (k) s.add(k);
  }
  return s;
}

/** Stored on `campaign_posts.bentley_draft_json` (caption stays on `caption`). */
export type BentleyPostDraftJson = {
  hook?: string;
  cta?: string;
  promptText?: string;
  promptImage?: string;
  promptVideo?: string;
};

export function normalizeBentleyPostPlatformKey(platform: unknown): string {
  return coerceTrimmedString(platform).toLowerCase();
}

function isBentleyPlatformPostKey(k: string): k is (typeof BENTLEY_PLATFORM_POST_KEYS)[number] {
  return (BENTLEY_PLATFORM_POST_KEYS as readonly string[]).includes(k);
}

/**
 * Platform-specific caption: prefers `campaign.platformPosts[platform]`, else hook + offer rotation.
 */
export function buildCaptionForPlatform(platform: string, campaign: CampaignResponse): string {
  const key = normalizeBentleyPostPlatformKey(platform);
  const slot = isBentleyPlatformPostKey(key) ? campaign.platformPosts[key] : undefined;
  if (coerceTrimmedString(slot?.caption)) return coerceTrimmedString(slot?.caption);
  const hooks = campaign.shortFormHooks ?? [];
  const offer = coerceTrimmedString(campaign.offerStatement);
  let h = 0;
  for (let i = 0; i < key.length; i++) h += key.charCodeAt(i);
  const hook = hooks.length ? coerceTrimmedString(hooks[h % hooks.length]) : "";
  if (hook && offer) return `${hook}\n\n${offer}`;
  if (offer) return offer;
  if (hook) return hook;
  return "Bentley campaign post";
}

export function buildBentleyDraftForPlatform(platform: string, campaign: CampaignResponse): BentleyPostDraftJson {
  const key = normalizeBentleyPostPlatformKey(platform);
  const slot = isBentleyPlatformPostKey(key) ? campaign.platformPosts[key] : undefined;
  return {
    hook: coerceTrimmedString(slot?.hook),
    cta: coerceTrimmedString(slot?.cta),
    promptText: coerceTrimmedString(slot?.promptText),
    promptImage: coerceTrimmedString(slot?.promptImage),
    promptVideo: coerceTrimmedString(slot?.promptVideo),
  };
}

export function computeScheduledAt(args: {
  strategy: ScheduleStrategy;
  slotIndex: number;
  totalSlots: number;
  staggerMinutes: number;
  nowMs: number;
  /** Lead time before worker may claim (ms). */
  leadMs?: number;
}): Date {
  const lead = args.leadMs ?? 120_000;
  const base = args.nowMs + lead;
  if (args.strategy === "immediate") {
    return new Date(base);
  }
  const step = Math.max(1, args.staggerMinutes) * 60_000;
  return new Date(base + args.slotIndex * step);
}
