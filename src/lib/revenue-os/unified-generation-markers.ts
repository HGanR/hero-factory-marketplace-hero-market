/**
 * Phase 4G — Deterministic markers so campaign brief / embedded blocks dedupe on repeat generation.
 * Hash is browser-safe (no Node `crypto`) so client panels can wrap briefs.
 */

export const CAMPAIGN_BRIEF_BEGIN = "---BEGIN_AI_REVENUE_OS_CAMPAIGN_BRIEF---";
export const CAMPAIGN_BRIEF_END = "---END_AI_REVENUE_OS_CAMPAIGN_BRIEF---";

export const CONVERSION_BLOCK_BEGIN = "---BEGIN_AI_REVENUE_OS_CONVERSION_INTELLIGENCE---";
export const CONVERSION_BLOCK_END = "---END_AI_REVENUE_OS_CONVERSION_INTELLIGENCE---";

function hash10(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 10);
}

/** Wrap brief content with markers + content hash for dedupe checks. */
export function wrapCampaignBriefWithMarkers(briefBody: string): string {
  const body = briefBody.trim();
  if (!body) return "";
  const h = hash10(body);
  return [
    CAMPAIGN_BRIEF_BEGIN,
    `fingerprint:${h}`,
    "",
    body,
    "",
    CAMPAIGN_BRIEF_END,
  ].join("\n");
}

export function extractCampaignBriefFromNotes(text: string): { rest: string; brief: string | null } {
  const re = new RegExp(
    `${escapeRe(CAMPAIGN_BRIEF_BEGIN)}\\s*(?:fingerprint:[^\\n]+\\n)?\\s*([\\s\\S]*?)${escapeRe(CAMPAIGN_BRIEF_END)}`,
    "m"
  );
  const m = text.match(re);
  if (!m) return { rest: text, brief: null };
  const brief = m[1].trim();
  const rest = text.replace(re, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { rest, brief: brief || null };
}

export function stripCampaignBriefMarkers(text: string): string {
  return extractCampaignBriefFromNotes(text).rest;
}

export function notesContainCampaignBriefMarker(text: string): boolean {
  return text.includes(CAMPAIGN_BRIEF_BEGIN) && text.includes(CAMPAIGN_BRIEF_END);
}

export function appendCampaignBriefIfMissing(fullNotes: string, briefBody: string): string {
  const wrapped = wrapCampaignBriefWithMarkers(briefBody);
  if (!wrapped) return fullNotes;
  const h = hash10(briefBody.trim());
  if (fullNotes.includes(`fingerprint:${h}`)) return fullNotes;
  const base = fullNotes.trimEnd();
  return base ? `${base}\n\n${wrapped}` : wrapped;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
