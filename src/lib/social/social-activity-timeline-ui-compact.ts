/**
 * UI-only compaction for social activity timelines (Revenue OS planner detail).
 * Does not change API payloads or stored audit rows — purely presentation.
 *
 * Rules:
 * - Input order is **newest first** (same as `activityTimeline` from the API).
 * - Only consecutive entries whose `kind` is in `SOCIAL_PATCH_TIMELINE_BURST_KINDS` may merge.
 * - Adjacent entries in a run must be within `burstWindowMs` on `at` (abs diff).
 * - Runs shorter than `minBurstSize` stay as singles.
 * - Never merge kinds outside the set (e.g. `approved`, `publish_failed`, `created`).
 */

import type { SocialActivityTimelineEntry, SocialActivityTimelineEventKind } from "@/lib/social/social-publish-observability";

/** Kinds that map from PATCH / worker-adjacent social edits (not governance decisions or publish outcomes). */
export const SOCIAL_PATCH_TIMELINE_BURST_KINDS: ReadonlySet<SocialActivityTimelineEventKind> = new Set([
  "content_changed",
  "schedule_changed",
  "link_changed",
  "account_changed",
  "asset_changed",
  "edit_reset_approval",
  "resubmitted",
]);

const FACET_LABEL: Partial<Record<SocialActivityTimelineEventKind, string>> = {
  content_changed: "content",
  schedule_changed: "schedule",
  link_changed: "link",
  account_changed: "account",
  asset_changed: "media asset",
  edit_reset_approval: "approval reset",
  resubmitted: "resubmitted",
};

export type SocialActivityTimelineDisplayRow =
  | { mode: "single"; entry: SocialActivityTimelineEntry }
  | {
      mode: "burst";
      /** Newest timestamp in the burst (matches first entry). */
      at: string;
      label: string;
      detail: string | null;
      entries: SocialActivityTimelineEntry[];
    };

function isBurstKind(k: SocialActivityTimelineEventKind): boolean {
  return SOCIAL_PATCH_TIMELINE_BURST_KINDS.has(k);
}

function timeDiffMs(a: string, b: string): number {
  return Math.abs(Date.parse(a) - Date.parse(b));
}

function formatBurstLabel(entries: SocialActivityTimelineEntry[]): { label: string; detail: string | null } {
  const seen = new Set<SocialActivityTimelineEventKind>();
  const facets: string[] = [];
  for (const e of entries) {
    if (seen.has(e.kind)) continue;
    seen.add(e.kind);
    const f = FACET_LABEL[e.kind];
    if (f) facets.push(f);
  }
  const label = facets.length ? `Post updated (${facets.join(", ")})` : "Post updated";
  return { label, detail: null };
}

/**
 * Merge tightly clustered PATCH-style timeline rows for calmer UI.
 */
export function compactSocialActivityTimelineForDisplay(
  entries: SocialActivityTimelineEntry[],
  opts?: { burstWindowMs?: number; minBurstSize?: number }
): SocialActivityTimelineDisplayRow[] {
  const burstWindowMs = opts?.burstWindowMs ?? 2500;
  const minBurstSize = opts?.minBurstSize ?? 2;
  const out: SocialActivityTimelineDisplayRow[] = [];
  let i = 0;
  while (i < entries.length) {
    const cur = entries[i]!;
    if (!isBurstKind(cur.kind)) {
      out.push({ mode: "single", entry: cur });
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < entries.length) {
      const next = entries[j + 1]!;
      if (!isBurstKind(next.kind)) break;
      if (timeDiffMs(entries[j]!.at, next.at) > burstWindowMs) break;
      j += 1;
    }
    const run = entries.slice(i, j + 1);
    if (run.length >= minBurstSize) {
      const { label, detail } = formatBurstLabel(run);
      out.push({
        mode: "burst",
        at: run[0]!.at,
        label,
        detail,
        entries: run,
      });
      i = j + 1;
    } else {
      out.push({ mode: "single", entry: cur });
      i += 1;
    }
  }
  return out;
}
