/**
 * Detect whether buyer-style questions repeat across multiple public post captions and/or comments.
 * Deterministic stem matching only — no media analysis.
 */

import type { PublicCommentMeta, PublicPostMeta } from "./types";

const Q_HINT = /\?|how (much|do|can|does)|what('s| is)|when (can|do|are)|where (are|do|can)|price|cost|rate|fee|book|schedule|appointment|available|take (clients|patients|customers)/i;

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^\w\s?']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export type RepeatedAcrossPostsResult = {
  repeatedAcrossPosts: boolean;
  /** Max stem frequency across distinct surfaces (posts + comments). */
  repeatedAcrossPostsCount: number;
};

/**
 * A stem is "repeated across posts" if it appears in at least two distinct sources
 * where a source is either a post caption index or a comment bucket.
 */
export function detectRepeatedBuyerQuestionsAcrossPosts(
  posts: PublicPostMeta[],
  comments: PublicCommentMeta[]
): RepeatedAcrossPostsResult {
  const buckets = new Map<string, { count: number; sources: Set<string> }>();

  posts.forEach((p, i) => {
    const t = p.captionSnippet?.trim() ?? "";
    if (t.length < 12 || !Q_HINT.test(t)) return;
    const key = normalizeKey(t);
    if (key.length < 10) return;
    const cur = buckets.get(key) ?? { count: 0, sources: new Set<string>() };
    cur.count++;
    cur.sources.add(`p${i}`);
    buckets.set(key, cur);
  });

  comments.forEach((c, i) => {
    const t = c.text.trim();
    if (t.length < 12 || !Q_HINT.test(t)) return;
    const key = normalizeKey(t);
    if (key.length < 10) return;
    const cur = buckets.get(key) ?? { count: 0, sources: new Set<string>() };
    cur.count++;
    cur.sources.add(`c${i}`);
    buckets.set(key, cur);
  });

  let repeatedAcrossPostsCount = 0;
  let repeatedAcrossPosts = false;

  for (const [, v] of buckets) {
    if (v.count < 2) continue;
    if (v.sources.size >= 2) {
      repeatedAcrossPosts = true;
      repeatedAcrossPostsCount = Math.max(repeatedAcrossPostsCount, v.count);
    }
  }

  return { repeatedAcrossPosts, repeatedAcrossPostsCount };
}
