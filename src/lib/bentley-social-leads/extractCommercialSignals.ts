import type { CommentSurface, PostSurface } from "@/lib/bentley-social-leads/types";
import type { CommercialCommentSignals } from "@/lib/bentley-social-leads/types";

const BUYER = /how much|price|cost|book|schedule|call me|dm|available|quote/i;
const OBJ = /not sure|doesn.t work|scam|too expensive|bad experience|why/i;
const URG = /asap|urgent|today|this week|need help now/i;
const BOOK = /can.t book|booking|calendar|no slots|waitlist/i;
const LOC = /where are you|location|service area|travel to|near me/i;

/**
 * Deterministic keyword pass over public post/comment text (no LLM).
 */
export function extractCommercialSignals(
  posts: PostSurface[],
  comments: CommentSurface[]
): CommercialCommentSignals {
  const texts: string[] = [];
  for (const p of posts) {
    if (p.captionSnippet) texts.push(p.captionSnippet);
  }
  for (const c of comments) {
    if (c.text) texts.push(c.text);
  }
  const repeatedBuyerQuestions: string[] = [];
  const bookingFrictionSignals: string[] = [];
  const urgencySignals: string[] = [];
  const locationOrServiceAreaQuestions: string[] = [];
  const objectionExamples: string[] = [];

  for (const t of texts) {
    const s = t.trim();
    if (!s) continue;
    if (BUYER.test(s) && s.length < 400) repeatedBuyerQuestions.push(s.slice(0, 220));
    if (OBJ.test(s) && s.length < 400) objectionExamples.push(s.slice(0, 220));
    if (URG.test(s)) urgencySignals.push(s.slice(0, 160));
    if (BOOK.test(s)) bookingFrictionSignals.push(s.slice(0, 160));
    if (LOC.test(s)) locationOrServiceAreaQuestions.push(s.slice(0, 160));
  }

  const objectionClusters =
    objectionExamples.length > 0
      ? [{ label: "public_objection_language", examples: objectionExamples.slice(0, 4) }]
      : [];

  return {
    repeatedBuyerQuestions: repeatedBuyerQuestions.slice(0, 8),
    objectionClusters,
    bookingFrictionSignals: bookingFrictionSignals.slice(0, 6),
    urgencySignals: urgencySignals.slice(0, 6),
    locationOrServiceAreaQuestions: locationOrServiceAreaQuestions.slice(0, 6),
    repeatedAcrossPosts: new Set(repeatedBuyerQuestions).size >= 2,
    repeatedAcrossPostsCount: Math.min(8, repeatedBuyerQuestions.length),
  };
}
