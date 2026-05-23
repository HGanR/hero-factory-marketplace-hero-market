/**
 * Executive Administration voice-only phrase detection (no LLM).
 * Used by voice/chat Skipper hail detection — not NPC/widget surfaces.
 */

import { resolveVoiceOperationalQuery } from "@/lib/executive-agent/executive-voice-operational-phrases";
import { buildTimeAwareSkipperGreeting } from "@/lib/executive-agent/executive-presence-voice";

export { buildTimeAwareSkipperGreeting } from "@/lib/executive-agent/executive-presence-voice";

export function buildSkipperGreetingResponse(now?: Date): string {
  return buildTimeAwareSkipperGreeting("", now);
}

export function buildAnalyticsClarificationResponse(): string {
  return "Would you like to know site visits, active users, traffic sources, conversions, or something else, Chief?";
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Normalize STT transcript before voice routing (lowercase, collapse space, strip punctuation). */
export function normalizeExecutiveVoiceTranscript(transcript: string): string {
  return transcript
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"()[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Remove Skipper wake/hail prefix; returns remainder for greeting vs query detection. */
export function stripSkipperWakePhrase(normalizedTranscript: string): string {
  let t = normalizedTranscript.trim();
  if (!t) return t;

  t = t.replace(/^good\s+(morning|afternoon|evening)(?:\s+skipper)?\b\s*,?\s*/, "");
  t = t.replace(/^(?:hello|hi|hey|yo)(?:\s+skipper)?\b\s*,?\s*/, "");
  t = t.replace(/^skipper\b\s*,?\s*/, "");
  return t.trim();
}

const GREETING_TAIL_ONLY =
  /^(?:boss|chief|there|how\s+are\s+you|what'?s\s+up|what\s+can\s+you\s+do(?:\s+for\s+me)?|how\s+can\s+you\s+help(?:\s+me)?|anything\s+new|status\s+update|report\s+in)$/;

const SIMPLE_GREETING_BODY =
  /^(?:hello|hi|hey|yo|good\s+(?:morning|afternoon|evening)|skipper)(?:\s+(?:boss|chief|there|skipper|how\s+are\s+you|what'?s\s+up|what\s+can\s+you\s+do(?:\s+for\s+me)?|how\s+can\s+you\s+help(?:\s+me)?|anything\s+new|status\s+update|report\s+in))*$/;

export type ExecutiveVoiceTurnClassification = "greeting_only" | "operational_query" | "orchestrator";

export function classifyExecutiveVoiceTranscript(transcript: string): {
  transcript: string;
  normalizedTranscript: string;
  strippedContent: string;
  classification: ExecutiveVoiceTurnClassification;
} {
  const trimmed = transcript.trim();
  const normalizedTranscript = normalizeExecutiveVoiceTranscript(trimmed);
  const strippedContent = stripSkipperWakePhrase(normalizedTranscript);

  if (isSimpleExecutiveGreeting(trimmed)) {
    return { transcript: trimmed, normalizedTranscript, strippedContent, classification: "greeting_only" };
  }
  if (resolveVoiceOperationalQuery(trimmed) != null) {
    return { transcript: trimmed, normalizedTranscript, strippedContent, classification: "operational_query" };
  }
  return { transcript: trimmed, normalizedTranscript, strippedContent, classification: "orchestrator" };
}

/** True when the utterance is only a hail/greeting with no operational follow-up. */
export function isSimpleExecutiveGreeting(transcript: string): boolean {
  const normalized = normalizeExecutiveVoiceTranscript(transcript);
  if (!normalized) return false;

  if (resolveVoiceOperationalQuery(transcript) != null) return false;
  if (isTodayAnalyticsQuestion(transcript) || hasSpecificAnalyticsMetric(transcript)) return false;

  const stripped = stripSkipperWakePhrase(normalized);
  if (!stripped) return true;
  if (GREETING_TAIL_ONLY.test(stripped)) return true;
  return SIMPLE_GREETING_BODY.test(stripped);
}

/** If any of these appear, skip vague “today’s analytics” clarification and run full orchestration. */
export function hasSpecificAnalyticsMetric(input: string): boolean {
  const p = norm(input);
  const needles = [
    "site visits",
    "page views",
    "pageviews",
    "visits",
    "active users",
    "unique visitor",
    "traffic sources",
    "attribution",
    "conversions",
    "conversion rate",
    "revenue",
    "join community",
    "paypal",
    "campaign",
    "funnel",
  ];
  return needles.some((n) => p.includes(n));
}

/** @deprecated Prefer isSimpleExecutiveGreeting — kept for existing imports. */
export function isSkipperGreeting(input: string): boolean {
  return isSimpleExecutiveGreeting(input);
}

export function isTodayAnalyticsQuestion(input: string): boolean {
  if (resolveVoiceOperationalQuery(input) === "site_analytics") return false;
  if (hasSpecificAnalyticsMetric(input)) return false;
  const t = norm(input);
  if (!t) return false;
  if (/\bwhat\s+are\s+today'?s\s+analytics\b/.test(t)) return true;
  if (/\bwhat\s+are\s+the\s+days\s+analytics\b/.test(t)) return true;
  if (/\btoday'?s\s+analytics\b/.test(t)) return true;
  if (/\banalytics\s+for\s+today\b/.test(t)) return true;
  if (/\bhow\s+are\s+we\s+doing\s+today\b/.test(t)) return true;
  return false;
}

export type AnalyticsFollowUpCategory = "site_visits" | "active_users" | "traffic_sources" | "conversions";

/**
 * After analytics clarification, map a short follow-up to an analytics focus for the orchestrator prompt.
 */
export function resolveAnalyticsFollowUpCategory(input: string): AnalyticsFollowUpCategory | null {
  const t = norm(input);
  if (!t) return null;
  if (/\b(site\s+)?visits\b/.test(t) || /^visits$/i.test(t.trim())) return "site_visits";
  if (/\bactive\s+users?\b/.test(t)) return "active_users";
  if (/\btraffic\s+sources?\b/.test(t)) return "traffic_sources";
  if (/\bconversions?\b/.test(t)) return "conversions";
  return null;
}

export function buildVoiceAnalyticsFollowUpPrompt(category: AnalyticsFollowUpCategory): string {
  const focus =
    category === "site_visits"
      ? "Emphasize site visits, page views, and traffic volume for the selected time window."
      : category === "active_users"
        ? "Emphasize active users, sessions, and engagement depth."
        : category === "traffic_sources"
          ? "Emphasize traffic sources, channels, and attribution."
          : "Emphasize conversions, goals, and funnel outcomes.";
  return `Voice follow-up: the user previously asked for today's analytics at a high level; they now want detail on ${category.replace(/_/g, " ")}. ${focus} Summarize read-only platform analytics accordingly.`;
}
