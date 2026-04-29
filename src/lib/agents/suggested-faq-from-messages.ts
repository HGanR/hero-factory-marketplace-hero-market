/**
 * Heuristic “suggested FAQ” candidates: repeat visitor questions (no LLM call).
 */
export function normalizeVisitorQuestion(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export type SuggestedFaqUpdate = {
  questionSample: string;
  occurrenceCount: number;
  hint: string;
};

const MIN_LEN = 12;
const MIN_COUNT = 2;

export function buildSuggestedFaqUpdates(
  userMessages: string[],
  max = 5,
): SuggestedFaqUpdate[] {
  const counts = new Map<string, { count: number; sample: string }>();
  for (const raw of userMessages) {
    const t = raw?.trim() ?? "";
    if (t.length < MIN_LEN) continue;
    const key = normalizeVisitorQuestion(t);
    if (key.length < MIN_LEN) continue;
    const prev = counts.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(key, { count: 1, sample: t.length > 200 ? `${t.slice(0, 200)}…` : t });
    }
  }
  return [...counts.entries()]
    .filter(([, v]) => v.count >= MIN_COUNT)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, max)
    .map(([, v]) => ({
      questionSample: v.sample,
      occurrenceCount: v.count,
      hint: "Add an FAQ in Knowledge so the widget answers this consistently without burning tokens on repeats.",
    }));
}
