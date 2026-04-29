import {
  hasAffirmativeContradictionMarkers,
  isWriteConfirmationContextValid,
} from "@/lib/agent-plugins/write-confirmation-context";

const assistantThread = [{ role: "assistant" as const, content: "Ready to send the draft?" }];

describe("hasAffirmativeContradictionMarkers", () => {
  it("detects mixed or contradictory approvals", () => {
    const rejected = [
      "yes but wait",
      "yes, not yet",
      "go ahead tomorrow instead",
      "send it — actually no",
      "send it - actually no",
      "book it, wait",
      "do it, but not now",
      "do it, not now",
      "I confirm but wait",
      "confirmation: wait please",
    ];
    for (const msg of rejected) {
      expect(hasAffirmativeContradictionMarkers(msg)).toBe(true);
    }
  });

  it("does not flag clean approvals or neutral text", () => {
    const ok = [
      "yes",
      "yes please",
      "go ahead",
      "send it",
      "book it",
      "ok go ahead",
      "I confirm the meeting details",
      "yes no problem",
    ];
    for (const msg of ok) {
      expect(hasAffirmativeContradictionMarkers(msg)).toBe(false);
    }
  });
});

describe("isWriteConfirmationContextValid", () => {
  const priorUserOnly = [{ role: "user" as const, content: "Hello" }];

  it("blocks short affirmative when no assistant has spoken in thread or this loop", () => {
    const r = isWriteConfirmationContextValid({
      userMessage: "yes",
      priorMessages: priorUserOnly,
      currentLoopAssistantTurns: [],
    });
    expect(r.ok).toBe(false);
  });

  it("allows clean affirmatives after a prior assistant turn", () => {
    for (const msg of ["yes", "yes please", "go ahead", "send it", "book it", "ok go ahead"]) {
      const r = isWriteConfirmationContextValid({
        userMessage: msg,
        priorMessages: [
          { role: "user", content: "Schedule 3pm?" },
          { role: "assistant", content: "I can create that event. Shall I proceed?" },
        ],
        currentLoopAssistantTurns: [],
      });
      expect(r.ok).toBe(true);
    }
  });

  it("rejects contradictory short replies even with assistant context", () => {
    for (const msg of [
      "yes but wait",
      "yes, not yet",
      "go ahead tomorrow instead",
      "send it — actually no",
      "book it, wait",
      "do it, but not now",
    ]) {
      const r = isWriteConfirmationContextValid({
        userMessage: msg,
        priorMessages: assistantThread,
        currentLoopAssistantTurns: [],
      });
      expect(r.ok).toBe(false);
    }
  });

  it("allows yes when assistant text exists only in the current tool loop", () => {
    const r = isWriteConfirmationContextValid({
      userMessage: "go ahead",
      priorMessages: priorUserOnly,
      currentLoopAssistantTurns: ["I've prepared the draft. Confirm to send."],
    });
    expect(r.ok).toBe(true);
  });

  it("treats confirmation wording as valid when assistant was in thread", () => {
    const r = isWriteConfirmationContextValid({
      userMessage: "I confirm the meeting",
      priorMessages: [
        { role: "assistant", content: "Here is what I will create." },
        { role: "user", content: "details?" },
      ],
      currentLoopAssistantTurns: [],
    });
    expect(r.ok).toBe(true);
  });

  it("blocks confirm wording when contradiction markers are present", () => {
    const r = isWriteConfirmationContextValid({
      userMessage: "I confirm but please wait",
      priorMessages: assistantThread,
      currentLoopAssistantTurns: [],
    });
    expect(r.ok).toBe(false);
  });

  it("blocks ambiguous or non-committal replies even with assistant context", () => {
    for (const msg of [
      "maybe",
      "not sure",
      "can you explain?",
      "later",
      "I'll think about it",
    ]) {
      const r = isWriteConfirmationContextValid({
        userMessage: msg,
        priorMessages: [{ role: "assistant", content: "Ready to create?" }],
        currentLoopAssistantTurns: [],
      });
      expect(r.ok).toBe(false);
    }
  });

  it("allows explicit one-shot create intent without prior assistant (long message)", () => {
    const r = isWriteConfirmationContextValid({
      userMessage:
        "Please create a calendar block tomorrow 2–3pm titled Interview — I confirm this is what I want scheduled.",
      priorMessages: [],
      currentLoopAssistantTurns: [],
    });
    expect(r.ok).toBe(true);
  });

  it("rejects too-short messages for one-shot path", () => {
    const r = isWriteConfirmationContextValid({
      userMessage: "please create it",
      priorMessages: [],
      currentLoopAssistantTurns: [],
    });
    expect(r.ok).toBe(false);
  });

  it("rejects extra words after a clean opener (conservative)", () => {
    const r = isWriteConfirmationContextValid({
      userMessage: "yes do it now",
      priorMessages: assistantThread,
      currentLoopAssistantTurns: [],
    });
    expect(r.ok).toBe(false);
  });
});
