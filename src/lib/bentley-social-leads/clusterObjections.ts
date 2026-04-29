/**
 * Group objection-style comments into compact operator-facing clusters.
 */

import type { PublicCommentMeta } from "./types";

const OBJ_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "price_or_value", re: /\b(too expensive|too much|overpriced|not worth|cheaper|discount)\b/i },
  { label: "trust_or_risk", re: /\b(scam|sketchy|worried|legit|trust|refund|guarantee)\b/i },
  { label: "timing_or_fit", re: /\b(not ready|maybe later|wrong (area|fit)|doesn'?t work for)\b/i },
  { label: "competitor_or_alt", re: /\b(instead|someone else|other (guy|shop|place)|went with)\b/i },
  { label: "service_quality", re: /\b(bad experience|disappointed|never again|poor service)\b/i },
];

export type ObjectionCluster = { label: string; examples: string[] };

export function clusterObjections(comments: PublicCommentMeta[], maxPerCluster = 3, maxClusters = 6): ObjectionCluster[] {
  const map = new Map<string, string[]>();

  for (const c of comments) {
    if (!c.classifications.includes("objection")) continue;
    const t = c.text.trim();
    if (t.length < 8) continue;
    let label = "general_objection";
    for (const p of OBJ_PATTERNS) {
      if (p.re.test(t)) {
        label = p.label;
        break;
      }
    }
    const arr = map.get(label) ?? [];
    if (arr.length < maxPerCluster) arr.push(t.slice(0, 200));
    map.set(label, arr);
  }

  return [...map.entries()]
    .filter(([, ex]) => ex.length > 0)
    .slice(0, maxClusters)
    .map(([label, examples]) => ({ label, examples }));
}
