/**
 * Cluster repeated buyer-style questions from visible comment text (deterministic).
 */

import type { PublicCommentMeta } from "./types";

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

/**
 * Returns deduped question strings ordered by approximate frequency (bucketed stems).
 */
export function clusterBuyerQuestions(comments: PublicCommentMeta[], maxOut = 10): string[] {
  const buckets = new Map<string, { count: number; example: string }>();

  for (const c of comments) {
    const t = c.text.trim();
    if (t.length < 12) continue;
    if (!Q_HINT.test(t)) continue;
    const key = normalizeKey(t);
    if (key.length < 10) continue;
    const cur = buckets.get(key);
    if (cur) {
      cur.count++;
      if (t.length < cur.example.length) cur.example = t.slice(0, 220);
    } else {
      buckets.set(key, { count: 1, example: t.slice(0, 220) });
    }
  }

  return [...buckets.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].example.length - a[1].example.length)
    .slice(0, maxOut)
    .map(([, v]) => v.example);
}
