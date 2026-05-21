import type { RevisionIntent } from "@/lib/fulfillment/revision-intelligence";

export type DraftVersionComparison = {
  hasComparison: boolean;
  previousVersion: number | null;
  currentVersion: number;
  summary: string;
  improvements: string[];
  regressions: string[];
  unchangedThemes: string[];
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / Math.max(a.size, b.size);
}

const THEME_KEYWORDS: Record<string, RegExp> = {
  cta: /\b(cta|call|book|schedule|quote|order|contact)\b/i,
  trust: /\b(review|testimonial|trust|badge|insured|certified)\b/i,
  hero: /\b(hero|headline|banner)\b/i,
  offer: /\b(offer|discount|free|promo|package)\b/i,
  mobile: /\b(mobile|responsive|tap|phone)\b/i,
  local: /\b(local|map|address|city|area)\b/i,
};

function detectThemes(text: string): string[] {
  return Object.entries(THEME_KEYWORDS)
    .filter(([, re]) => re.test(text))
    .map(([k]) => k);
}

export function compareDraftVersions(input: {
  previousBody: string | null;
  currentBody: string;
  currentVersion: number;
  previousVersion?: number | null;
  revisionIntent?: RevisionIntent | null;
}): DraftVersionComparison {
  const currentVersion = input.currentVersion;
  const previousVersion = input.previousVersion ?? (currentVersion > 1 ? currentVersion - 1 : null);

  if (!input.previousBody?.trim()) {
    return {
      hasComparison: false,
      previousVersion,
      currentVersion,
      summary: currentVersion > 1 ? "Prior draft text not on file for comparison." : "First draft version — no prior comparison.",
      improvements: [],
      regressions: [],
      unchangedThemes: [],
    };
  }

  const prev = input.previousBody.trim();
  const curr = input.currentBody.trim();
  const prevTokens = tokenize(prev);
  const currTokens = tokenize(curr);
  const similarity = overlapScore(prevTokens, currTokens);

  const prevThemes = new Set(detectThemes(prev));
  const currThemes = new Set(detectThemes(curr));
  const improvements: string[] = [];
  const regressions: string[] = [];
  const unchangedThemes: string[] = [];

  for (const theme of currThemes) {
    if (!prevThemes.has(theme)) improvements.push(`Added emphasis: ${theme}`);
    else unchangedThemes.push(theme);
  }
  for (const theme of prevThemes) {
    if (!currThemes.has(theme)) regressions.push(`Less visible: ${theme}`);
  }

  if (curr.length > prev.length * 1.15) improvements.push("Draft detail expanded vs prior version.");
  if (curr.length < prev.length * 0.85) regressions.push("Draft is shorter — verify nothing critical was dropped.");

  if (input.revisionIntent?.priorities.length) {
    const addressed = input.revisionIntent.priorities.filter((p) =>
      curr.toLowerCase().includes(p.toLowerCase().slice(0, Math.min(24, p.length)))
    );
    if (addressed.length) improvements.push(`Likely addressed ${addressed.length} revision note(s).`);
    const missing = input.revisionIntent.priorities.length - addressed.length;
    if (missing > 0) regressions.push(`${missing} revision priority item(s) not clearly reflected in draft text.`);
  }

  const summary =
    similarity > 0.72
      ? `v${previousVersion} → v${currentVersion}: mostly similar copy (${Math.round(similarity * 100)}% overlap) — check revision intent was applied.`
      : `v${previousVersion} → v${currentVersion}: substantive rewrite (${Math.round(similarity * 100)}% overlap).`;

  return {
    hasComparison: true,
    previousVersion,
    currentVersion,
    summary,
    improvements: dedupe(improvements, 8),
    regressions: dedupe(regressions, 6),
    unchangedThemes: [...unchangedThemes],
  };
}

function dedupe(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
    if (out.length >= max) break;
  }
  return out;
}
