/**
 * Deterministic semantic compression for SKIPPER learning — produces *suggestions only*.
 * Does not mutate base system prompts, model weights, or execute side effects.
 */

export type SkipperLearningQuestionTurn = {
  source: "chat" | "voice";
  question: string;
  answer: string;
  createdAt?: string | null;
  plannerMetaJson?: string | null;
};

export type SkipperLearningEventTurn = {
  eventType: string;
  source: string;
  payloadJson: string;
};

export type SkipperLearningCompressionInput = {
  questionTurns: SkipperLearningQuestionTurn[];
  learningEvents: SkipperLearningEventTurn[];
};

export type SkipperLearningCompressionOutput = {
  patterns: string[];
  preferences: string[];
  suggestedMemories: string[];
  suggestedPromptImprovements: string[];
  suggestedCapabilities: string[];
};

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function parsePlannerTools(meta: string | null | undefined): string[] {
  if (!meta?.trim()) return [];
  try {
    const o = JSON.parse(meta) as { readTools?: unknown };
    if (!o || !Array.isArray(o.readTools)) return [];
    return o.readTools.filter((x): x is string => typeof x === "string" && x.length > 0);
  } catch {
    return [];
  }
}

function countMap(keys: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of keys) {
    const n = (m.get(k) ?? 0) + 1;
    m.set(k, n);
  }
  return m;
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
}

/**
 * Compress admin Q&A, feedback events, and planner hints into structured learning artifacts.
 * Output is safe to persist as proposals — never treated as authoritative prompt replacement.
 */
export function compressSkipperLearningSignals(input: SkipperLearningCompressionInput): SkipperLearningCompressionOutput {
  const patterns: string[] = [];
  const preferences: string[] = [];
  const suggestedMemories: string[] = [];
  const suggestedPromptImprovements: string[] = [];
  const suggestedCapabilities: string[] = [];

  const qNorms = input.questionTurns.map((t) => norm(t.question).slice(0, 500));
  const qCount = countMap(qNorms.filter(Boolean));
  for (const [q, c] of qCount) {
    if (c >= 2 && q.length > 12) {
      patterns.push(`Repeated admin question (${c}× in window): "${q.slice(0, 160)}${q.length > 160 ? "…" : ""}"`);
    }
  }

  const analyticsHits = input.questionTurns.filter(
    (t) =>
      /\b(analytics|traffic|funnel|conversion|kpi|dashboard)\b/i.test(t.question) ||
      /\b(analytics|traffic|funnel)\b/i.test(t.answer),
  );
  if (analyticsHits.length >= 2) {
    patterns.push(
      `Recurring analytics-style requests (${analyticsHits.length} turns) — consider tightening default read tool ordering for analytics intents.`,
    );
  }

  const toolCounts = countMap(input.questionTurns.flatMap((t) => parsePlannerTools(t.plannerMetaJson)));
  for (const [tool, c] of toolCounts) {
    if (c >= 3) {
      patterns.push(`Frequently selected read tool "${tool}" (${c}×) — desk may benefit from a short overlay reminding when to prefer it.`);
    }
  }

  const shortAnswers = input.questionTurns.filter((t) => t.answer.trim().length > 0 && t.answer.trim().length < 120);
  if (shortAnswers.length >= 2) {
    patterns.push(`${shortAnswers.length} unusually short executive answers — review clarity or planner confidence.`);
  }

  for (const ev of input.learningEvents) {
    if (ev.eventType === "helpful") {
      preferences.push("Admin marked at least one executive reply as helpful — reinforce similar tone and structure.");
    }
    if (ev.eventType === "not_helpful") {
      suggestedPromptImprovements.push(
        "When admins mark replies not helpful: prefer explicit uncertainty, cite which tools were used, and offer 2–3 concrete next checks.",
      );
    }
    if (ev.eventType === "save_memory") {
      try {
        const p = JSON.parse(ev.payloadJson) as { title?: string; summary?: string };
        if (p.title && p.summary) {
          suggestedMemories.push(`Remember: ${String(p.title).slice(0, 200)} — ${String(p.summary).slice(0, 400)}`);
        }
      } catch {
        suggestedMemories.push("Admin saved desk memory from chat — reinforce capturing stable operational preferences.");
      }
    }
    if (ev.eventType === "suggest_improvement") {
      try {
        const p = JSON.parse(ev.payloadJson) as { note?: string };
        if (p.note?.trim()) {
          suggestedPromptImprovements.push(`Admin suggestion (pending review): ${p.note.trim().slice(0, 800)}`);
        }
      } catch {
        suggestedPromptImprovements.push("Admin submitted a generic improvement suggestion — review in learning inbox.");
      }
    }
    if (ev.eventType === "voice_command") {
      patterns.push(
        "Repeated voice command usage — keep voice clarification paths and analytics follow-ups aligned with desk policy.",
      );
    }
  }

  if (toolCounts.has("getPlatformAnalyticsSummary") && !toolCounts.has("getBentleyExecutiveBridgeSummary")) {
    suggestedCapabilities.push(
      "Consider a feature flag to auto-suggest Bentley bridge read when analytics summaries are requested repeatedly (developer task only).",
    );
  }

  return {
    patterns: uniq(patterns).slice(0, 24),
    preferences: uniq(preferences).slice(0, 16),
    suggestedMemories: uniq(suggestedMemories).slice(0, 16),
    suggestedPromptImprovements: uniq(suggestedPromptImprovements).slice(0, 16),
    suggestedCapabilities: uniq(suggestedCapabilities).slice(0, 12),
  };
}
