export type InboxInsightInput = {
  id: string;
  sourceType: string;
  intent: string | null;
  sentiment: string | null;
  status: string;
  requiresManual?: boolean;
  lastMessageAt: Date | null;
  preview: string;
  provider: string;
  metadataJson: unknown;
};

/**
 * Count intents + light examples for the inbox insights API (no heavy analytics).
 */
export function aggregateInboxInsights(threads: InboxInsightInput[], examplesPerBucket = 3) {
  const byIntent: Record<string, { count: number; examples: { id: string; preview: string }[] }> = {};
  const bySourceType: Record<string, { count: number; examples: { id: string; preview: string }[] }> = {};
  const questions: { id: string; preview: string }[] = [];
  const highIntent: { id: string; preview: string }[] = [];
  const objections: { id: string; preview: string }[] = [];
  const negative: { id: string; preview: string }[] = [];
  let needsManualAttention = 0;
  for (const t of threads) {
    if (t.status === "manual_only" || t.requiresManual) {
      needsManualAttention += 1;
    }
    const st = (t.sourceType || "unknown").toLowerCase();
    if (!bySourceType[st]) {
      bySourceType[st] = { count: 0, examples: [] };
    }
    bySourceType[st].count += 1;
    if (bySourceType[st].examples.length < examplesPerBucket) {
      bySourceType[st].examples.push({ id: t.id, preview: t.preview.slice(0, 200) });
    }
    const intent = (t.intent || "unclear").toLowerCase();
    if (!byIntent[intent]) {
      byIntent[intent] = { count: 0, examples: [] };
    }
    byIntent[intent].count += 1;
    if (byIntent[intent].examples.length < examplesPerBucket) {
      byIntent[intent].examples.push({ id: t.id, preview: t.preview.slice(0, 200) });
    }
    if (intent === "question" && questions.length < examplesPerBucket) {
      questions.push({ id: t.id, preview: t.preview.slice(0, 200) });
    }
    if (intent === "lead" && highIntent.length < examplesPerBucket) {
      highIntent.push({ id: t.id, preview: t.preview.slice(0, 200) });
    }
    if (intent === "complaint" && objections.length < examplesPerBucket) {
      objections.push({ id: t.id, preview: t.preview.slice(0, 200) });
    }
    if ((t.sentiment || "").toLowerCase() === "negative" && negative.length < examplesPerBucket) {
      negative.push({ id: t.id, preview: t.preview.slice(0, 200) });
    }
  }

  return {
    byIntent,
    bySourceType,
    topQuestionsThisWeek: questions,
    commonObjections: objections,
    highIntentThreads: highIntent,
    negativeOrUnhappyExamples: negative,
    needsManualAttentionCount: needsManualAttention,
  };
}
