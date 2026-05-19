/**
 * Executive Administration voice-only phrase detection (no LLM).
 * Used by POST /api/admin/executive-agent/voice/turn — not NPC/widget surfaces.
 */

export function buildSkipperGreetingResponse(): string {
  return "Good day, Boss. How can I help you today?";
}

export function buildAnalyticsClarificationResponse(): string {
  return "Would you like to know site visits, active users, traffic sources, conversions, or something else, Chief?";
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
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

export function isSkipperGreeting(input: string): boolean {
  const t = norm(input);
  if (!t) return false;
  if (t === "skipper") return true;
  if (/^(hello|hi|hey)\s+skipper[!.,?]*$/i.test(t)) return true;
  if (/^good\s+(morning|afternoon|evening)\s+skipper[!.,?]*$/i.test(t)) return true;
  return false;
}

export function isTodayAnalyticsQuestion(input: string): boolean {
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
