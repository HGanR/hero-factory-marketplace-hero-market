/**
 * Derive heuristic post-level labels from visible page text only (no media analysis).
 */

import type { PostKind, PublicPostMeta } from "./types";

function classifyCaption(text: string): PostKind[] {
  const t = text.toLowerCase();
  const labels: PostKind[] = [];
  if (/learn how|tips|tutorial|explained|guide\b/i.test(t)) labels.push("educational");
  if (/sale|discount|offer|limited time|link in bio|shop now|buy/i.test(t)) labels.push("promotional");
  if (/review|before and after|client|testimonial|results/i.test(t)) labels.push("testimonial");
  if (/trend|viral|fyp|#trend/i.test(t)) labels.push("trend_based");
  if (/book|apply|dm me|link in bio|comment below/i.test(t)) labels.push("direct_offer");
  if (/book|schedule|calendly|link in bio/i.test(t)) labels.push("strong_cta");
  if (/check out|learn more/i.test(t) && !/book|schedule|calendly|link in bio/i.test(t)) labels.push("weak_cta");
  if (/\?{2,}|how much|price|cost/i.test(t)) labels.push("high_curiosity");
  if (/buy|ready to|when can we|sign me up/i.test(t)) labels.push("strong_buyer_intent");
  if (labels.length === 0) labels.push("low_buyer_intent");
  return [...new Set(labels)];
}

/**
 * Without platform-specific JSON, we synthesize 1–3 placeholder post summaries from page copy
 * so operators still get structured buckets (clearly marked as surface-limited).
 */
export function summarizePostMetadata(html: string, title?: string, description?: string): PublicPostMeta[] {
  const text = `${title ?? ""}\n${description ?? ""}\n${html.slice(0, 12_000)}`;
  const chunks: string[] = [];
  const paras = text.split(/\n\n|<\/p>/i).map((s) => s.replace(/<[^>]+>/g, " ").trim()).filter((s) => s.length > 40);
  for (const p of paras.slice(0, 5)) {
    if (chunks.length >= 3) break;
    chunks.push(p.slice(0, 400));
  }
  if (chunks.length === 0 && (title || description)) {
    chunks.push(`${title ?? ""} ${description ?? ""}`.trim().slice(0, 400));
  }

  return chunks.map((captionSnippet, i) => ({
    id: `surface-${i}`,
    captionSnippet,
    classifications: classifyCaption(captionSnippet),
  }));
}
