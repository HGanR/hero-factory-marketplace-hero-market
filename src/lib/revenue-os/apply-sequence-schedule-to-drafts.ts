/**
 * Match sequence schedule slots to campaign posts / drafts — pure logic for UI + tests.
 */

import type { RevenueOsContentBatchRole } from "@/lib/revenue-os/content-batch-routing-types";
import type { RevenueOsBatchCalendarSequence } from "@/lib/revenue-os/content-batch-calendar-sequencing-types";
import type {
  RevenueOsSuggestedSchedulePlan,
  RevenueOsSuggestedScheduleSlot,
} from "@/lib/revenue-os/content-sequence-schedule-types";

export type CampaignPostForScheduleApply = {
  id: string;
  platform: string;
  scheduledAt: string | Date | null | undefined;
  utmParams?: Record<string, string> | null;
};

export type ApplySequenceScheduleAction =
  | "skip"
  | "utm_suggestion_only"
  | "set_scheduled_at"
  | "needs_replace_confirm";

export type ApplySequenceScheduleRow = {
  postId: string;
  slotIndex: number;
  action: ApplySequenceScheduleAction;
  reason: string;
  mergedUtmParams?: Record<string, string>;
  nextScheduledAtIso?: string;
};

export type ApplySequenceScheduleToDraftsResult = {
  rows: ApplySequenceScheduleRow[];
  matchedCount: number;
  overwriteProtectionCount: number;
  suggestedMetadataAttachedCount: number;
};

function normPlatform(p: string): string {
  return p.trim().toLowerCase();
}

function postRole(p: CampaignPostForScheduleApply): RevenueOsContentBatchRole | null {
  const raw = p.utmParams?.bentley_content_role ?? p.utmParams?.["bentley_content_role"];
  if (!raw) return null;
  const r = String(raw).trim();
  if (
    r === "attention" ||
    r === "engagement" ||
    r === "authority" ||
    r === "lead_capture" ||
    r === "distribution_support"
  ) {
    return r;
  }
  return null;
}

function postSeqDay(p: CampaignPostForScheduleApply): number | null {
  const raw = p.utmParams?.bentley_sequence_day_index ?? p.utmParams?.["bentley_sequence_day_index"];
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function postMatchesSlotPlatforms(postPlatform: string, slot: RevenueOsSuggestedScheduleSlot): boolean {
  const hints = slot.preferredPlatforms.map((x) => normPlatform(x)).filter(Boolean);
  if (!hints.length) return true;
  const p = normPlatform(postPlatform);
  return hints.some((h) => h === p || h.replace(/\s+/g, "") === p.replace(/\s+/g, ""));
}

/**
 * Greedy match: walk schedule slots in order; for each, pick first unused post with matching role (+ platform hint), then sequence day if both present.
 */
export function matchPostsToScheduleSlots(
  posts: CampaignPostForScheduleApply[],
  schedulePlan: RevenueOsSuggestedSchedulePlan,
  sequence?: RevenueOsBatchCalendarSequence | null
): { postId: string; slotIndex: number }[] {
  const pairs: { postId: string; slotIndex: number }[] = [];
  const usedPost = new Set<string>();
  const slots = schedulePlan.slots;

  for (let si = 0; si < slots.length; si++) {
    const slot = slots[si]!;
    const seqDay = sequence?.slots[si]?.dayIndex ?? slot.dayIndex;
    let best: { idx: number; score: number } | null = null;

    for (let pi = 0; pi < posts.length; pi++) {
      const post = posts[pi]!;
      if (usedPost.has(post.id)) continue;
      const role = postRole(post);
      if (role !== slot.role) continue;
      if (!postMatchesSlotPlatforms(post.platform, slot)) continue;

      let score = 2;
      const d = postSeqDay(post);
      if (d != null && d === seqDay) score += 2;
      if (post.utmParams?.bentley_draft_key) score += 1;

      if (!best || score > best.score) {
        best = { idx: pi, score };
      }
    }

    if (best == null) {
      for (let pi = 0; pi < posts.length; pi++) {
        const post = posts[pi]!;
        if (usedPost.has(post.id)) continue;
        const role = postRole(post);
        if (role !== slot.role) continue;
        let score = 1;
        const d = postSeqDay(post);
        if (d != null && d === seqDay) score += 2;
        if (!best || score > best.score) {
          best = { idx: pi, score };
        }
      }
    }

    if (best != null) {
      const post = posts[best.idx]!;
      usedPost.add(post.id);
      pairs.push({ postId: post.id, slotIndex: si });
    }
  }

  return pairs;
}

function mergeUtm(
  prev: Record<string, string> | null | undefined,
  slot: RevenueOsSuggestedScheduleSlot
): Record<string, string> {
  const next = { ...(prev ?? {}) };
  if (slot.suggestedScheduledAt) {
    next.bentley_suggested_schedule_at = slot.suggestedScheduledAt;
  }
  next.bentley_schedule_role = slot.role;
  next.bentley_schedule_confidence = slot.confidence;
  return next;
}

function hasScheduledAt(v: string | Date | null | undefined): boolean {
  if (v == null) return false;
  if (v instanceof Date) return !Number.isNaN(v.getTime());
  return String(v).trim().length > 0;
}

export type ApplySequenceScheduleToDraftsArgs = {
  posts: CampaignPostForScheduleApply[];
  schedulePlan: RevenueOsSuggestedSchedulePlan;
  batchCalendarSequence?: RevenueOsBatchCalendarSequence | null;
  /** When true, rows may use set_scheduled_at if allowed. */
  confirmSetScheduledAt?: boolean;
  /** When true, existing scheduledAt may be replaced; otherwise needs_replace_confirm. */
  confirmReplaceScheduledAt?: boolean;
  /** When true, only merge UTM suggestion fields (no scheduledAt changes). */
  guidanceOnly?: boolean;
};

/**
 * Plan PATCH payloads for applying schedule hints. Does not perform network I/O.
 */
export function applySequenceScheduleToDrafts(args: ApplySequenceScheduleToDraftsArgs): ApplySequenceScheduleToDraftsResult {
  const pairs = matchPostsToScheduleSlots(args.posts, args.schedulePlan, args.batchCalendarSequence ?? null);
  const postById = new Map(args.posts.map((p) => [p.id, p]));
  const rows: ApplySequenceScheduleRow[] = [];
  let overwriteProtectionCount = 0;
  let suggestedMetadataAttachedCount = 0;

  for (const { postId, slotIndex } of pairs) {
    const post = postById.get(postId);
    const slot = args.schedulePlan.slots[slotIndex];
    if (!post || !slot) continue;

    const mergedUtmParams = mergeUtm(post.utmParams ?? null, slot);
    suggestedMetadataAttachedCount += 1;

    if (args.guidanceOnly) {
      rows.push({
        postId,
        slotIndex,
        action: "utm_suggestion_only",
        reason: "Guidance-only: merged suggested schedule fields into utmParams; did not set scheduledAt.",
        mergedUtmParams,
      });
      continue;
    }

    if (!args.confirmSetScheduledAt) {
      rows.push({
        postId,
        slotIndex,
        action: "skip",
        reason: "Set confirmSetScheduledAt to apply calendar times.",
        mergedUtmParams,
      });
      continue;
    }

    const iso = slot.suggestedScheduledAt;
    if (!iso) {
      rows.push({
        postId,
        slotIndex,
        action: "utm_suggestion_only",
        reason: "No ISO timestamp on slot — metadata only.",
        mergedUtmParams,
      });
      continue;
    }

    if (!hasScheduledAt(post.scheduledAt)) {
      rows.push({
        postId,
        slotIndex,
        action: "set_scheduled_at",
        reason: "Draft had no scheduledAt — safe to set from suggested slot.",
        mergedUtmParams,
        nextScheduledAtIso: iso,
      });
      continue;
    }

    if (!args.confirmReplaceScheduledAt) {
      overwriteProtectionCount += 1;
      rows.push({
        postId,
        slotIndex,
        action: "needs_replace_confirm",
        reason: "Post already has scheduledAt — confirm replace to overwrite.",
        mergedUtmParams,
        nextScheduledAtIso: iso,
      });
      continue;
    }

    rows.push({
      postId,
      slotIndex,
      action: "set_scheduled_at",
      reason: "User confirmed replacing existing scheduledAt.",
      mergedUtmParams,
      nextScheduledAtIso: iso,
    });
  }

  return {
    rows,
    matchedCount: pairs.length,
    overwriteProtectionCount,
    suggestedMetadataAttachedCount,
  };
}
