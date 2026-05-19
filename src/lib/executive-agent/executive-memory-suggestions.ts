/**
 * Heuristic memory suggestions from chat/voice — never persisted here.
 */

export type ExecutiveMemorySuggestion = {
  memoryType: "preference" | "client_priority" | "recurring_issue" | "agent_pattern" | "system_note" | "decision";
  subjectType?: string | null;
  subjectId?: string | null;
  title: string;
  summary: string;
  suggestionSource: "chat" | "voice";
  confidence: number;
};

const PREF = /\b(from now on|going forward|always prefer|I prefer|please remember to|for future sessions)\b/i;
const DECISION = /\b(my decision is|we decided|I decided|final decision:|executive decision)\b/i;
const RECURRING = /\b(again|recurring|keeps happening|still not resolved|every time this)\b/i;
const PATTERN = /\b(pattern|usually happens|tends to|as a rule)\b/i;
const CLIENT_PRIO = /\b(priority client|top priority|focus on this client|urgent for)\b/i;
const METRICS = /\b(metrics?|kpi|dashboard|conversion|revenue|attribution|funnel|analytics)\b/i;
const REPORTS = /\b(report|weekly|monthly|summary|briefing|digest|spreadsheet|export)\b/i;
const PRIORITIES = /\b(priorities|roadmap|quarter|growth plan|strategic|north star)\b/i;
const AGENT_PREF = /\b(prefer|use bentley|use eleanor|use reality|skipper|agent filter)\b/i;

export function buildSuggestedExecutiveMemoryItems(input: {
  prompt: string;
  channel: "chat" | "voice";
  selectedClientId?: string | null;
  reasoningSummary?: string | null;
  queuedApprovalTitles?: string[];
  proposedWriteActions?: string[];
}): ExecutiveMemorySuggestion[] {
  const text = [input.prompt, input.reasoningSummary ?? ""].join("\n").trim();
  if (!text) return [];

  const out: ExecutiveMemorySuggestion[] = [];
  const push = (s: Omit<ExecutiveMemorySuggestion, "suggestionSource" | "confidence"> & { confidence?: number }) => {
    if (out.length >= 6) return;
    out.push({
      ...s,
      suggestionSource: input.channel,
      confidence: s.confidence ?? 0.55,
    });
  };

  const st = input.selectedClientId?.trim() || null;
  const subjectType = st ? "client" : null;
  const subjectId = st;

  if (PREF.test(text)) {
    push({
      memoryType: "preference",
      subjectType,
      subjectId,
      title: "Capture stated preference",
      summary: text.slice(0, 800),
      confidence: 0.62,
    });
  }
  if (DECISION.test(text)) {
    push({
      memoryType: "decision",
      subjectType,
      subjectId,
      title: "Record explicit decision",
      summary: text.slice(0, 800),
      confidence: 0.68,
    });
  }
  if (RECURRING.test(text)) {
    push({
      memoryType: "recurring_issue",
      subjectType,
      subjectId,
      title: "Possible recurring client or ops issue",
      summary: text.slice(0, 800),
      confidence: 0.52,
    });
  }
  if (PATTERN.test(text)) {
    push({
      memoryType: "agent_pattern",
      subjectType,
      subjectId,
      title: "Operational or agent pattern",
      summary: text.slice(0, 800),
      confidence: 0.5,
    });
  }
  if (CLIENT_PRIO.test(text)) {
    push({
      memoryType: "client_priority",
      subjectType,
      subjectId,
      title: "Client priority signal",
      summary: text.slice(0, 800),
      confidence: 0.58,
    });
  }

  if (METRICS.test(text)) {
    push({
      memoryType: "preference",
      subjectType: "metrics",
      subjectId: null,
      title: "Preferred metrics / reporting lens",
      summary: text.slice(0, 800),
      confidence: 0.5,
    });
  }
  if (REPORTS.test(text)) {
    push({
      memoryType: "preference",
      subjectType: "reports",
      subjectId: null,
      title: "Frequently requested reports",
      summary: text.slice(0, 800),
      confidence: 0.48,
    });
  }
  if (PRIORITIES.test(text)) {
    push({
      memoryType: "client_priority",
      subjectType: "business",
      subjectId: null,
      title: "Recurring business priorities",
      summary: text.slice(0, 800),
      confidence: 0.52,
    });
  }
  if (AGENT_PREF.test(text)) {
    push({
      memoryType: "agent_pattern",
      subjectType: "agents",
      subjectId: null,
      title: "Preferred agents or routing bias",
      summary: text.slice(0, 800),
      confidence: 0.49,
    });
  }

  const approvals = input.queuedApprovalTitles?.filter(Boolean) ?? [];
  if (approvals.length) {
    push({
      memoryType: "decision",
      subjectType: "approval_queue",
      subjectId: null,
      title: "Review queued executive approvals",
      summary: `Pending titles: ${approvals.slice(0, 6).join("; ")}`.slice(0, 800),
      confidence: 0.48,
    });
  }

  const writes = input.proposedWriteActions?.filter(Boolean) ?? [];
  if (writes.length) {
    push({
      memoryType: "system_note",
      subjectType: "write_intent",
      subjectId: null,
      title: "Write intents proposed this turn",
      summary: `Actions: ${[...new Set(writes)].slice(0, 8).join(", ")}`.slice(0, 800),
      confidence: 0.45,
    });
  }

  return out;
}
