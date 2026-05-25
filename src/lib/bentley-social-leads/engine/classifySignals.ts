import type { LeadPainType, LeadUrgency, LeadCommercialReadinessStage } from "./taxonomy";
import type { LeadIntentClassification } from "./domainTypes";
import type { CommercialReadiness } from "../types";
const PAIN_KEYWORDS: Array<{ k: LeadPainType; re: RegExp }> = [
  { k: "lead_generation", re: /lead|leads|pipeline|dm|inbox/i },
  { k: "low_sales", re: /sales|revenue|quiet|slow month|not enough clients/i },
  { k: "content_problem", re: /content|posting|algorithm|engagement|views/i },
  { k: "appointment_problem", re: /book|schedule|calendar|appointment|slot/i },
  { k: "trust_credibility_problem", re: /trust|scam|reviews|proof|credibility/i },
];

export function classifyPainFromText(corpus: string): LeadPainType {
  const t = corpus.toLowerCase();
  for (const { k, re } of PAIN_KEYWORDS) {
    if (re.test(t)) return k;
  }
  return "other";
}

export function classifyUrgencyFromText(corpus: string): LeadUrgency {
  const t = corpus.toLowerCase();
  if (/\basap\b|urgent|today|right now|emergency/i.test(t)) return "urgent";
  if (/this week|soon|quickly|fast/i.test(t)) return "high";
  if (/next month|eventually|thinking about/i.test(t)) return "low";
  return "medium";
}

export function inferCommercialStageFromSignals(
  readiness: CommercialReadiness,
  corpus: string
): LeadCommercialReadinessStage {
  const t = corpus.toLowerCase();
  if (readiness === "high" || /buy now|invoice|deposit|contract/i.test(t)) return "ready_now";
  if (readiness === "moderate" || /compare|options|quote/i.test(t)) return "shopping";
  if (/solution|tool|software|service that/i.test(t)) return "solution_aware";
  if (/problem|struggling|issue|stuck/i.test(t)) return "problem_aware";
  return "unaware";
}

export function classifyIntentFlags(corpus: string): LeadIntentClassification {
  const t = corpus.toLowerCase();
  const urgency = classifyUrgencyFromText(t);
  return {
    hasExplicitHelpRequest: /\bhelp\b|can someone|how do i|need advice/i.test(t),
    hasFirstPersonPain: /\bi\b.*\b(struggle|hate|can't|cannot|worried|stressed)\b/i.test(t),
    hasRecommendationAsk: /recommend|suggestion|what would you|any ideas/i.test(t),
    hasFrustrationMarkers: /ugh|annoying|frustrat|fed up|tired of/i.test(t),
    hasUrgencyMarkers: urgency === "urgent" || urgency === "high",
    hasMoneyOrRevenueRef: /\$|usd|revenue|profit|budget|price|cost/i.test(t),
    hasOwnerSelfId: /\b(i|we) run\b|\bmy business\b|\bour (shop|agency|studio)\b/i.test(t),
  };
}
