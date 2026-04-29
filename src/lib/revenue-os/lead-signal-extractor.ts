/**
 * Heuristic extraction of lead intent from feedback rows, notes, or raw interaction text.
 * Safe with sparse / empty input — never throws.
 */

export type LeadSignalClass =
  | "curiosity"
  | "objection"
  | "buying_intent"
  | "urgency"
  | "trust_seeking"
  | "mixed"
  | "unknown";

export type ExtractedLeadSignal = {
  sourcePlatform: string;
  sourceType: string;
  sourceRef: string | null;
  topic: string | null;
  hookType: string | null;
  angle: string | null;
  sentimentScore: number;
  commercialIntentScore: number;
  urgencyScore: number;
  handoffReadiness: number;
  extractedText: string;
  extractedEntitiesJson: Record<string, unknown> | null;
  recommendedFollowup: string;
  signalClass: LeadSignalClass;
  experimentId: string | null;
  experimentVariantId: string | null;
};

export type LeadSignalExtractionInput = {
  contentFeedbackRows?: Array<{
    platform?: string | null;
    notes?: string | null;
    rawPayload?: unknown;
    sentiment?: string | null;
  }>;
  experimentResultNotes?: string[];
  rawInteractions?: Array<Record<string, unknown>>;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function classify(text: string): LeadSignalClass {
  const t = text.toLowerCase();
  if (/scam|too expensive|not sure|worried|doesn'?t work|skeptic|prove|case study|testimonial|review/i.test(t)) {
    if (/prove|case study|testimonial|review|credentials/i.test(t)) return "trust_seeking";
    return "objection";
  }
  if (/buy|purchase|book|demo|pricing|cost|roi|sign up|apply|ready to/i.test(t)) return "buying_intent";
  if (/urgent|asap|today|this week|deadline|need now/i.test(t)) return "urgency";
  if (/curious|wondering|how does|tell me more|question/i.test(t)) return "curiosity";
  if (t.length >= 12) return "mixed";
  return "unknown";
}

function scoresForClass(
  cls: LeadSignalClass,
  sentimentHint: number
): { commercial: number; urgency: number; sentiment: number; handoff: number } {
  const base = clamp01(0.45 + sentimentHint * 0.25);
  switch (cls) {
    case "buying_intent":
      return { commercial: clamp01(0.82 + sentimentHint * 0.1), urgency: 0.55, sentiment: base, handoff: 0.78 };
    case "urgency":
      return { commercial: 0.62, urgency: clamp01(0.8 + sentimentHint * 0.05), sentiment: base, handoff: 0.72 };
    case "objection":
      return { commercial: 0.38, urgency: 0.35, sentiment: clamp01(0.35 + sentimentHint * 0.2), handoff: 0.42 };
    case "trust_seeking":
      return { commercial: 0.52, urgency: 0.4, sentiment: base, handoff: 0.58 };
    case "curiosity":
      return { commercial: 0.48, urgency: 0.3, sentiment: clamp01(0.55 + sentimentHint * 0.15), handoff: 0.45 };
    case "mixed":
      return { commercial: 0.5, urgency: 0.45, sentiment: base, handoff: 0.5 };
    default:
      return { commercial: 0.4, urgency: 0.35, sentiment: 0.5, handoff: 0.35 };
  }
}

function followupForClass(cls: LeadSignalClass): string {
  switch (cls) {
    case "objection":
      return "Reply with a concise proof point + one clarifying question; offer a short educate asset.";
    case "buying_intent":
      return "Move to CTA: book / apply / DM keyword — keep friction low.";
    case "urgency":
      return "Acknowledge timeline; propose a fast next step (call slot or checklist).";
    case "trust_seeking":
      return "Share testimonial, case snippet, or third-party proof — avoid hard sell.";
    case "curiosity":
      return "Answer directly + tease a deeper resource; invite comment or DM.";
    default:
      return "Acknowledge and ask one qualifying question.";
  }
}

function textFromPayload(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const o = raw as Record<string, unknown>;
  const parts = [o.text, o.body, o.message, o.comment, o.note, o.summary]
    .map((x) => (typeof x === "string" ? x : ""))
    .filter(Boolean);
  return parts.join(" ").trim();
}

/**
 * Produces zero or more extracted signals from heterogeneous inputs.
 */
export function extractLeadSignalsFromFeedback(input: LeadSignalExtractionInput): ExtractedLeadSignal[] {
  const out: ExtractedLeadSignal[] = [];

  const rows = input.contentFeedbackRows ?? [];
  for (const row of rows) {
    const rawText = [row.notes, textFromPayload(row.rawPayload)].filter(Boolean).join("\n");
    const text = truncate(rawText, 4000);
    if (text.length < 3) continue;

    const cls = classify(text);
    const pos = row.sentiment?.toLowerCase().includes("pos") ? 0.2 : row.sentiment?.toLowerCase().includes("neg") ? -0.15 : 0;
    const { commercial, urgency, sentiment, handoff } = scoresForClass(cls, pos);

    const topic =
      typeof (row.rawPayload as Record<string, unknown>)?.topic === "string"
        ? String((row.rawPayload as Record<string, unknown>).topic).slice(0, 256)
        : null;

    out.push({
      sourcePlatform: (row.platform ?? "unknown").slice(0, 64),
      sourceType: "comment",
      sourceRef: null,
      topic,
      hookType: null,
      angle: null,
      sentimentScore: sentiment,
      commercialIntentScore: commercial,
      urgencyScore: urgency,
      handoffReadiness: handoff,
      extractedText: text,
      extractedEntitiesJson: null,
      recommendedFollowup: followupForClass(cls),
      signalClass: cls,
      experimentId: null,
      experimentVariantId: null,
    });
  }

  for (const note of input.experimentResultNotes ?? []) {
    const text = truncate(String(note ?? ""), 4000);
    if (text.length < 4) continue;
    const cls = classify(text);
    const { commercial, urgency, sentiment, handoff } = scoresForClass(cls, 0);
    out.push({
      sourcePlatform: "experiment",
      sourceType: "reaction_cluster",
      sourceRef: null,
      topic: null,
      hookType: null,
      angle: null,
      sentimentScore: sentiment,
      commercialIntentScore: commercial,
      urgencyScore: urgency,
      handoffReadiness: handoff,
      extractedText: text,
      extractedEntitiesJson: null,
      recommendedFollowup: followupForClass(cls),
      signalClass: cls,
      experimentId: null,
      experimentVariantId: null,
    });
  }

  for (const raw of input.rawInteractions ?? []) {
    const text = truncate(textFromPayload(raw) || String(raw.text ?? raw.message ?? ""), 4000);
    if (text.length < 3) continue;
    const cls = classify(text);
    const { commercial, urgency, sentiment, handoff } = scoresForClass(cls, 0);
    out.push({
      sourcePlatform: String(raw.platform ?? raw.source_platform ?? "unknown").slice(0, 64),
      sourceType: String(raw.source_type ?? raw.sourceType ?? "comment").slice(0, 48),
      sourceRef: raw.source_ref != null ? String(raw.source_ref).slice(0, 512) : null,
      topic: raw.topic != null ? String(raw.topic).slice(0, 256) : null,
      hookType: raw.hook_type != null ? String(raw.hook_type).slice(0, 64) : null,
      angle: raw.angle != null ? String(raw.angle).slice(0, 512) : null,
      sentimentScore: sentiment,
      commercialIntentScore: commercial,
      urgencyScore: urgency,
      handoffReadiness: handoff,
      extractedText: text,
      extractedEntitiesJson: typeof raw.entities === "object" && raw.entities ? (raw.entities as Record<string, unknown>) : null,
      recommendedFollowup: followupForClass(cls),
      signalClass: cls,
      experimentId: raw.experiment_id != null ? String(raw.experiment_id).slice(0, 36) : null,
      experimentVariantId: raw.experiment_variant_id != null ? String(raw.experiment_variant_id).slice(0, 36) : null,
    });
  }

  return out;
}
