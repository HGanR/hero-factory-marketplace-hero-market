export const REVISION_INTENT_THEMES = [
  "copy_tone",
  "layout_structure",
  "cta_conversion",
  "trust_proof",
  "hero_section",
  "offers_pricing",
  "mobile_experience",
  "local_seo",
  "sections_pages",
  "visual_brand",
  "other",
] as const;

export type RevisionIntentTheme = (typeof REVISION_INTENT_THEMES)[number];

export type RevisionIntent = {
  summary: string;
  themes: RevisionIntentTheme[];
  priorities: string[];
  confidence: "low" | "medium" | "high";
  sourceCount: number;
};

const THEME_PATTERNS: Array<{ theme: RevisionIntentTheme; patterns: RegExp[] }> = [
  { theme: "copy_tone", patterns: [/\b(copy|tone|wording|rewrite|headline|text)\b/i] },
  { theme: "layout_structure", patterns: [/\b(layout|section|reorder|structure|spacing)\b/i] },
  { theme: "cta_conversion", patterns: [/\b(cta|button|call[- ]?to[- ]?action|convert|booking)\b/i] },
  { theme: "trust_proof", patterns: [/\b(trust|review|testimonial|badge|proof|credential)\b/i] },
  { theme: "hero_section", patterns: [/\b(hero|above the fold|banner|headline image)\b/i] },
  { theme: "offers_pricing", patterns: [/\b(offer|price|discount|package|promo)\b/i] },
  { theme: "mobile_experience", patterns: [/\b(mobile|phone|responsive|tap)\b/i] },
  { theme: "local_seo", patterns: [/\b(local|map|address|city|service area|seo)\b/i] },
  { theme: "sections_pages", patterns: [/\b(page|menu|about|services|add section|remove)\b/i] },
  { theme: "visual_brand", patterns: [/\b(color|font|brand|logo|image|photo)\b/i] },
];

export function extractRevisionIntent(notes: string[]): RevisionIntent {
  const combined = notes.map((n) => n.trim()).filter(Boolean).join("\n");
  if (!combined) {
    return {
      summary: "No revision notes captured yet.",
      themes: [],
      priorities: [],
      confidence: "low",
      sourceCount: 0,
    };
  }

  const themes = new Set<RevisionIntentTheme>();
  for (const { theme, patterns } of THEME_PATTERNS) {
    if (patterns.some((p) => p.test(combined))) themes.add(theme);
  }
  if (!themes.size) themes.add("other");

  const sentences = combined
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 6);

  const priorities = sentences.slice(0, 4);
  const themeList = [...themes];
  const summary =
    priorities.length > 0
      ? `${themeList.map((t) => t.replace(/_/g, " ")).join(", ")}: ${priorities[0]}`
      : `Revision themes: ${themeList.join(", ")}`;

  return {
    summary: summary.slice(0, 500),
    themes: themeList,
    priorities,
    confidence: notes.length >= 2 ? "high" : notes.length === 1 ? "medium" : "low",
    sourceCount: notes.length,
  };
}

export type OrderEventRevisionSource = {
  payloadJson: string | null;
};

const REVISION_ACTIONS = new Set([
  "deliverable_revision_requested",
  "client_delivery_client_revision_requested",
]);

export function collectRevisionNotesFromEvents(events: OrderEventRevisionSource[]): string[] {
  const notes: string[] = [];
  for (const ev of events) {
    if (!ev.payloadJson?.trim()) continue;
    try {
      const payload = JSON.parse(ev.payloadJson) as { action?: string; revisionNote?: string };
      if (!payload.action || !REVISION_ACTIONS.has(payload.action)) continue;
      const note = typeof payload.revisionNote === "string" ? payload.revisionNote.trim() : "";
      if (note) notes.push(note);
    } catch {
      /* skip */
    }
  }
  return notes;
}
