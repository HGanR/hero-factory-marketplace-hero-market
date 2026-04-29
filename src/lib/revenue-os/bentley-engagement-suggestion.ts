import type { SocialEngagementCapabilities } from "@/lib/social/engagement/social-engagement-capabilities";
import type { SocialEngagementSourceType } from "@/lib/social/engagement/social-engagement-capabilities";
import { socialEngagementAiSuggestions } from "@/lib/db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export type BentleyEngagementSuggestion = {
  intent: "lead" | "question" | "complaint" | "booking" | "spam" | "praise" | "unclear";
  sentiment: "positive" | "neutral" | "negative";
  urgency: "low" | "normal" | "high";
  suggestedOperatorAction: string;
  suggestedDraftReply: string;
  manualOnlyReason: string | null;
  suggestionType: "triage_v1";
};

const Q = /\b(how much|price|cost|quote|interested|sign up|book|schedule|call)\b/i;
const NEG = /\b(angry|terrible|refund|scam|worst|disappointed|complaint)\b/i;
const SPAM = /\b(follow me|check my page|dm for|click here|crypto|giveaway)\b/i;
const PRAISE = /\b(thank|love|great|awesome|helped|amazing)\b/i;

/**
 * Deterministic triage (no LLM). Safe for first operator pass.
 */
export function buildBentleyEngagementSuggestion(args: {
  text: string;
  sourceType: SocialEngagementSourceType;
  provider: string;
  capabilities: SocialEngagementCapabilities;
}): BentleyEngagementSuggestion {
  const t = (args.text || "").trim();
  let intent: BentleyEngagementSuggestion["intent"] = "unclear";
  if (SPAM.test(t)) intent = "spam";
  else if (NEG.test(t)) intent = "complaint";
  else if (Q.test(t)) intent = t.match(/book|schedule|call/i) ? "booking" : "lead";
  else if (PRAISE.test(t)) intent = "praise";
  else if (/\?/.test(t) || /\b(how|what|why|when)\b/i.test(t)) intent = "question";

  let sentiment: BentleyEngagementSuggestion["sentiment"] = "neutral";
  if (NEG.test(t) || intent === "complaint") sentiment = "negative";
  else if (PRAISE.test(t) || intent === "praise") sentiment = "positive";

  let urgency: BentleyEngagementSuggestion["urgency"] = "normal";
  if (intent === "complaint" || NEG.test(t)) urgency = "high";
  else if (intent === "spam") urgency = "low";

  const manualOnlyReason = args.capabilities.requiresManualForReplies
    ? args.capabilities.reasons[0] ?? "In-app reply path is not available — use native app or copy the draft below."
    : null;

  let suggestedOperatorAction = "Review thread and assign owner.";
  if (manualOnlyReason) {
    suggestedOperatorAction = "Copy the suggested text and post in the native " + args.provider + " app.";
  } else if (intent === "spam") {
    suggestedOperatorAction = "Mark as triaged; hide or report in provider if available.";
  } else {
    suggestedOperatorAction = "Reply in governed workflow when your policy allows; otherwise draft only.";
  }

  const name = t.slice(0, 20) || "there";
  const suggestedDraftReply =
    manualOnlyReason != null
      ? `Thanks for reaching out, ${name}. A teammate will follow up in the app shortly. (Automated in-app send is off — reply manually in ${args.provider}.)`
      : `Thanks for your message — we appreciate you. How can we help you next?`;

  return {
    intent,
    sentiment,
    urgency,
    suggestedOperatorAction,
    suggestedDraftReply,
    manualOnlyReason,
    suggestionType: "triage_v1",
  };
}

/**
 * Store latest triage in `social_engagement_ai_suggestions` (pending) for operator UI.
 */
export async function persistSuggestion(db: Db, threadId: string, suggestion: BentleyEngagementSuggestion): Promise<void> {
  const { randomUUID } = await import("crypto");
  const id = randomUUID();
  await db.insert(socialEngagementAiSuggestions).values({
    id,
    threadId,
    suggestionType: suggestion.suggestionType,
    suggestedText: suggestion.suggestedDraftReply,
    rationaleJson: {
      intent: suggestion.intent,
      sentiment: suggestion.sentiment,
      urgency: suggestion.urgency,
      action: suggestion.suggestedOperatorAction,
      manualOnlyReason: suggestion.manualOnlyReason,
    },
    status: "pending",
  });
}
