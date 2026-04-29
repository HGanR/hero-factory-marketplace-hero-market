/**
 * Server-side rules so write tools only run after an intentional confirmation path.
 * The client must send prior chat turns via `priorMessages` (multi-turn test/widget).
 */

/** Passed from the capabilities panel test button — skips multi-turn context checks when confirmed. */
export const AGENT_BUILDER_TEST_USER_MESSAGE = "__agent_builder_test__";

export type AgentChatTurn = { role: "user" | "assistant"; content: string };

export type AgentConversationContext = {
  priorMessages: AgentChatTurn[];
  userMessage: string;
  currentLoopAssistantTurns?: string[];
};

/**
 * True when the message mixes approval with hesitation, negation, or a change of mind.
 * Conservative: used to block short affirmatives and loose "confirm" matches for writes.
 */
export function hasAffirmativeContradictionMarkers(message: string): boolean {
  const t = message.trim();
  if (!t) return false;

  const patterns: RegExp[] = [
    /\b(yes|yep|yeah|yup|ok|okay|sure)\s+(but|however|although)\b/i,
    /\b(yes|yep|yeah|yup|ok|okay|sure)\s*[,;]?\s*(not yet|not now)\b/i,
    /\b(yes|yep|yeah|yup|ok|okay|sure)\s+\b(wait|hold on|hold off)\b/i,
    /\b(yes|yep|yeah|yup|ok|okay|sure)\s*,\s*\b(wait|hold on)\b/i,
    /\b(go ahead|send it|book it|do it)\s*[,;]?\s*(but|wait|instead|not now|not yet)\b/i,
    /\b(go ahead|send it|book it)\b[\s\S]{0,80}\b(tomorrow instead|instead)\b/i,
    /\b(send it|book it|do it)\s*[—\-]\s*(actually\s+)?no\b/i,
    /\b(do it)\s*,\s*but\s+not\s+now\b/i,
    /\b(do it)\s*[,;]?\s*(but not now|not now)\b/i,
    /\b(book it)\s*,\s*wait\b/i,
    /\bconfirm(?:ed|ation)?\b[\s\S]{0,100}\b(but|wait|not yet|not now|instead)\b/i,
  ];

  return patterns.some((re) => re.test(t));
}

/**
 * Whole-message match only: clean approvals with optional light punctuation.
 * Anything extra (e.g. "yes do it now") fails — conservative for writes.
 */
function isShortAffirmative(userMessage: string): boolean {
  const t = userMessage.trim();
  if (t.length > 160) return false;
  if (hasAffirmativeContradictionMarkers(t)) return false;

  return /^(?:yes(?:\s+(?:please|thanks|thank\s+you))?|yep|yeah|yup|ok|okay|sure|ok\s+go\s+ahead|okay\s+go\s+ahead|go\s+ahead|send\s+it|book\s+it|do\s+it|please\s+do|sounds\s+good|approve(?:d)?|proceed|confirm(?:ed)?)(?:\s*[.!?…]*)?$/i.test(
    t
  );
}

function hasExplicitOneShotCreateIntent(userMessage: string): boolean {
  const t = userMessage.trim();
  if (t.length < 24) return false;
  return /\b(i\s+confirm|please\s+(create|schedule|draft|send)|go\s+ahead\s+and\s+(create|schedule|draft|send)|confirmed[:\s])/i.test(
    t
  );
}

/**
 * Returns whether a write with `confirmed: true` is allowed given thread context.
 * `currentLoopAssistantTurns` = assistant text from the ongoing tool loop (same HTTP request).
 */
export function isWriteConfirmationContextValid(params: {
  userMessage: string;
  priorMessages: AgentChatTurn[];
  /** Non-empty assistant text already emitted in this model loop before the tool call. */
  currentLoopAssistantTurns?: string[];
}): { ok: true } | { ok: false; message: string } {
  const { userMessage, priorMessages, currentLoopAssistantTurns = [] } = params;
  const hasPriorAssistant = priorMessages.some((m) => m.role === "assistant");
  const hasAssistantTextThisLoop = currentLoopAssistantTurns.some((t) => t.trim().length > 0);
  const hasAssistantInThread = hasPriorAssistant || hasAssistantTextThisLoop;

  if (hasAssistantInThread && isShortAffirmative(userMessage)) {
    return { ok: true };
  }

  if (
    hasAssistantInThread &&
    /\bconfirm(?:ed|ation)?\b/i.test(userMessage) &&
    !hasAffirmativeContradictionMarkers(userMessage)
  ) {
    return { ok: true };
  }

  if (hasExplicitOneShotCreateIntent(userMessage) && !hasAffirmativeContradictionMarkers(userMessage)) {
    return { ok: true };
  }

  return {
    ok: false,
    message:
      "Write blocked: ask the user to confirm first, then call this tool with confirmed:true only after they agree in a follow-up message (or use a single message that clearly states they confirm the action).",
  };
}
