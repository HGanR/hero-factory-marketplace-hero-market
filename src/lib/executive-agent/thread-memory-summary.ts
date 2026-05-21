import type {
  ExecutiveOperationalThreadMessageDto,
  ExecutiveOperationalThreadDto,
} from "@/lib/executive-agent/executive-conversation-threads";
import { countUnresolvedQuestions } from "@/lib/executive-agent/executive-conversation-threads";

export type ThreadMemorySummaryInput = {
  thread: Pick<
    ExecutiveOperationalThreadDto,
    "title" | "status" | "priority" | "decisionNeeded" | "pinnedNoteText" | "threadKind"
  >;
  messages: Array<
    Pick<
      ExecutiveOperationalThreadMessageDto,
      "bodyText" | "messageKind" | "isPinned" | "createdAt"
    >
  >;
  maxChars?: number;
};

export function buildThreadMemorySummary(input: ThreadMemorySummaryInput): {
  summary: string;
  unresolvedQuestionCount: number;
  openQuestions: string[];
  pinnedExcerpts: string[];
  decisionSignals: string[];
} {
  const max = input.maxChars ?? 1200;
  const pinned = input.messages.filter((m) => m.isPinned).map((m) => m.bodyText.trim()).filter(Boolean);
  const pinnedNote = input.thread.pinnedNoteText?.trim();
  if (pinnedNote) pinned.unshift(`[Pinned note] ${pinnedNote}`);

  const questions = input.messages
    .filter((m) => m.messageKind === "question")
    .map((m) => m.bodyText.trim())
    .filter(Boolean);

  const decisions = input.messages
    .filter((m) => m.messageKind === "decision_request" || m.messageKind === "status_update")
    .slice(-4)
    .map((m) => m.bodyText.trim())
    .filter(Boolean);

  const recent = input.messages
    .filter((m) => m.messageKind === "discussion" || m.messageKind === "operational_note")
    .slice(-6)
    .map((m) => m.bodyText.trim())
    .filter(Boolean);

  const parts = [
    `${input.thread.title} · ${input.thread.status} · ${input.thread.priority}`,
    input.thread.decisionNeeded ? "Decision needed." : null,
    pinned.length ? `Pinned: ${pinned.join(" · ")}` : null,
    questions.length ? `Open questions: ${questions.slice(-3).join(" | ")}` : null,
    decisions.length ? `Decision/status: ${decisions.join(" | ")}` : null,
    recent.length ? `Recent: ${recent.join(" | ")}` : null,
  ].filter(Boolean);

  let summary = parts.join(" ");
  if (summary.length > max) summary = `${summary.slice(0, max - 1)}…`;

  return {
    summary,
    unresolvedQuestionCount: countUnresolvedQuestions(input.messages),
    openQuestions: questions.slice(-5),
    pinnedExcerpts: pinned.slice(0, 4),
    decisionSignals: decisions,
  };
}

export function summarizeThreadsForSkipper(
  threads: ExecutiveOperationalThreadDto[],
  maxThreads = 6
): string {
  const ranked = [...threads].sort((a, b) => {
    const score = (t: ExecutiveOperationalThreadDto) => {
      let s = 0;
      if (t.decisionNeeded) s += 40;
      if (t.priority === "urgent") s += 30;
      if (t.priority === "high") s += 20;
      if (t.unresolvedQuestionCount > 0) s += 15;
      if (t.status === "open") s += 10;
      return s;
    };
    return score(b) - score(a);
  });

  return ranked
    .slice(0, maxThreads)
    .map((t) => {
      const bits = [t.title, t.status, t.priority];
      if (t.decisionNeeded) bits.push("decision-needed");
      if (t.unresolvedQuestionCount) bits.push(`${t.unresolvedQuestionCount} open Q`);
      if (t.memorySummary) bits.push(t.memorySummary.slice(0, 120));
      return bits.join(" · ");
    })
    .join(" || ");
}
