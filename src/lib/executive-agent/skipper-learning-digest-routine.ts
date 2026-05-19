import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { insertExecutiveBroadcast } from "@/lib/executive-agent/executive-department-inbox-store";
import { listExecutiveQuestionHistorySince } from "@/lib/executive-agent/executive-question-history-store";
import { compressSkipperLearningSignals } from "@/lib/executive-agent/skipper-learning-compression";
import {
  insertSkipperCapabilitySuggestion,
  insertSkipperLearningSummary,
  insertSkipperPromptImprovementSuggestion,
  listSkipperLearningEventsSince,
} from "@/lib/executive-agent/skipper-learning-store";

type Db = MySql2Database<typeof schema>;

export type SkipperLearningDigestSummary = {
  summaryId: string;
  windowStart: string;
  windowEnd: string;
  patternCount: number;
  promptSuggestionsQueued: number;
  capabilitySuggestionsQueued: number;
};

/**
 * Daily learning digest: reads recent Q&A + learning events, compresses into proposals only.
 * Does **not** call approval executors, CRM mutators, or read tools — DB + inbox notification only.
 */
export async function runSkipperLearningDigestRoutine(db: Db, adminUserId: number): Promise<SkipperLearningDigestSummary> {
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

  const questions = await listExecutiveQuestionHistorySince(db, adminUserId, windowStart, 800);
  const events = await listSkipperLearningEventsSince(db, adminUserId, windowStart, 800);

  const compressed = compressSkipperLearningSignals({
    questionTurns: questions.map((q) => ({
      source: q.source,
      question: q.question,
      answer: q.answer,
      createdAt: q.createdAt != null ? new Date(q.createdAt).toISOString() : null,
      plannerMetaJson: q.plannerMetaJson,
    })),
    learningEvents: events.map((e) => ({
      eventType: e.eventType,
      source: e.source,
      payloadJson: e.payloadJson,
    })),
  });

  const summaryId = await insertSkipperLearningSummary(db, {
    adminUserId,
    windowStart,
    windowEnd,
    compressed: JSON.parse(JSON.stringify(compressed)) as Record<string, unknown>,
  });

  let promptSuggestionsQueued = 0;
  for (const line of compressed.suggestedPromptImprovements.slice(0, 6)) {
    await insertSkipperPromptImprovementSuggestion(db, {
      adminUserId,
      summaryId,
      title: `Prompt overlay candidate (${promptSuggestionsQueued + 1})`,
      rationale: "Derived from last-24h learning compression — requires human review before any overlay activation.",
      proposedOverlayContent: line.slice(0, 12_000),
    });
    promptSuggestionsQueued += 1;
  }

  let capabilitySuggestionsQueued = 0;
  for (const line of compressed.suggestedCapabilities.slice(0, 6)) {
    await insertSkipperCapabilitySuggestion(db, {
      adminUserId,
      summaryId,
      title: `Capability / flag backlog (${capabilitySuggestionsQueued + 1})`,
      description: line.slice(0, 12_000),
      suggestedFlagKey: null,
    });
    capabilitySuggestionsQueued += 1;
  }

  const headline = `[SKIPPER learning digest] ${compressed.patterns.length} pattern(s), ${promptSuggestionsQueued} prompt suggestion(s), ${capabilitySuggestionsQueued} capability note(s) — all pending admin review.`;
  await insertExecutiveBroadcast(db, adminUserId, headline, {
    kind: "skipper_learning_digest",
    summaryId,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
  });

  return {
    summaryId,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    patternCount: compressed.patterns.length,
    promptSuggestionsQueued,
    capabilitySuggestionsQueued,
  };
}
