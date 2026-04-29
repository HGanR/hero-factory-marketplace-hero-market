/**
 * Pure helpers for Bentley → campaign_posts planning (testable without DB).
 */

import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import { normalizeCampaignPostPlatformForPublish } from "@/lib/social/platform-identity";
import { isOauthConnectablePlatformId } from "@/lib/social/platform-identity";
import type { SocialPlatform } from "@/lib/social/config";

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
    const n = normalizeCampaignPostPlatformForPublish(raw.trim());
    if (n && isOauthConnectablePlatformId(n) && !out.includes(n)) out.push(n);
  };
  for (const p of input.postingPlatforms ?? []) {
    tryAdd(String(p));
  }
  if (out.length) return out;
  for (const label of input.contentPlatforms ?? []) {
    const low = label.trim().toLowerCase();
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
    const k = u?.[BENTLEY_UTM_UNIT_KEY]?.trim();
    if (k) s.add(k);
  }
  return s;
}

export function buildCaptionForSlot(campaign: CampaignResponse, slot: number): string {
  const hooks = campaign.shortFormHooks ?? [];
  const hook = hooks.length ? hooks[slot % hooks.length]!.trim() : "";
  const offer = (campaign.offerStatement ?? "").trim();
  if (hook && offer) return `${hook}\n\n${offer}`;
  if (offer) return offer;
  if (hook) return hook;
  return "Bentley campaign post";
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
