/**
 * Phase 4I — Heuristic themes from persisted snapshots + generated JSON (no extra LLM).
 */

const MAX_EACH = 6;
const MAX_LEN = 160;

function takeLines(text: string, max: number): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max)
    .map((s) => s.slice(0, MAX_LEN));
}

function fromSnapshot(snapshot: Record<string, unknown>): string[] {
  const out: string[] = [];
  const brief = typeof snapshot.campaignBrief === "string" ? snapshot.campaignBrief : "";
  if (brief) out.push(...takeLines(brief, 2));
  const notes = typeof snapshot.userNotesOriginal === "string" ? snapshot.userNotesOriginal : "";
  if (notes) out.push(...takeLines(notes, 2));
  const conv = snapshot.conversionIntelligence;
  if (conv && typeof conv === "object") {
    const rec = (conv as { recommendations?: unknown }).recommendations;
    if (Array.isArray(rec)) {
      for (const r of rec.slice(0, 3)) {
        if (r && typeof r === "object" && "title" in r && typeof (r as { title?: string }).title === "string") {
          out.push((r as { title: string }).title);
        }
      }
    }
  }
  const op = snapshot.operatorNextActionsSummary;
  if (op && typeof op === "object") {
    const b = (op as { bottlenecks?: string[] }).bottlenecks;
    if (Array.isArray(b)) out.push(...b.slice(0, 2));
  }
  return [...new Set(out.map((s) => s.trim()).filter(Boolean))].slice(0, MAX_EACH);
}

function fromGenerated(gen: Record<string, unknown>): { ctas: string[]; offers: string[] } {
  const ctas: string[] = [];
  const offers: string[] = [];
  const fp = gen.fullPost;
  if (fp && typeof fp === "object") {
    const cap = typeof (fp as { caption?: string }).caption === "string" ? (fp as { caption: string }).caption : "";
    const content =
      typeof (fp as { content?: string }).content === "string" ? (fp as { content: string }).content : "";
    const tail = cap.split(/\n/).filter(Boolean).slice(-2).join(" ");
    if (tail) ctas.push(tail.slice(0, MAX_LEN));
    const ctaLine = content.split(/\n/).find((l) => /book|call|dm|apply|link|schedule|reserve/i.test(l));
    if (ctaLine) ctas.push(ctaLine.trim().slice(0, MAX_LEN));
  }
  const viral = gen.viralIdeas;
  if (Array.isArray(viral)) {
    for (const v of viral.slice(0, 3)) {
      if (v && typeof v === "object" && typeof (v as { title?: string }).title === "string") {
        offers.push((v as { title: string }).title.slice(0, MAX_LEN));
      }
    }
  }
  const hooks = gen.hooks;
  if (Array.isArray(hooks)) {
    offers.push(...hooks.slice(0, 2).map((h) => String(h).slice(0, MAX_LEN)));
  }
  return {
    ctas: [...new Set(ctas)].slice(0, MAX_EACH),
    offers: [...new Set(offers)].slice(0, MAX_EACH),
  };
}

export type ScalingSignals = {
  painThemes: string[];
  ctaAngles: string[];
  offerAngles: string[];
};

export function extractScalingSignals(
  unifiedContextSnapshot: Record<string, unknown>,
  generatedOutput: Record<string, unknown>
): ScalingSignals {
  const painThemes = fromSnapshot(unifiedContextSnapshot);
  const { ctas, offers } = fromGenerated(generatedOutput);
  return {
    painThemes,
    ctaAngles: ctas,
    offerAngles: offers,
  };
}
