/**
 * Keyword/heuristic classification of visible comment text (no user targeting).
 */

import type { CommentKind } from "./types";

const PATTERNS: { kind: CommentKind; re: RegExp }[] = [
  { kind: "price_inquiry", re: /\b(how much|price|cost|rate|fee|discount|quote)\b/i },
  { kind: "booking_intent", re: /\b(book|schedule|call|appointment|slot|calendar)\b/i },
  { kind: "buyer_intent", re: /\b(i want|sign me up|interested|ready to|when can)\b/i },
  { kind: "objection", re: /\b(too expensive|not sure|scam|worried|concern)\b/i },
  { kind: "trust_signal", re: /\b(love|thank|helped|recommended|vouch)\b/i },
  { kind: "confusion", re: /\b(what do you mean|confused|how does|don'?t understand)\b/i },
  { kind: "spam", re: /\b(follow me|check my page|dm me for promo|click link)\b/i },
  { kind: "peer_support", re: /\b(same|me too|agree|facts)\b/i },
  { kind: "repeat_interest", re: /\b(again|still waiting|bumping|reminder)\b/i },
];

export function classifyComments(text: string): CommentKind[] {
  const kinds = new Set<CommentKind>();
  for (const { kind, re } of PATTERNS) {
    if (re.test(text)) kinds.add(kind);
  }
  if (kinds.size === 0) kinds.add("noise");
  return [...kinds];
}
