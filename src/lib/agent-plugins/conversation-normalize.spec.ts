import {
  normalizeAgentConversationContext,
  normalizeConversationHistory,
} from "@/lib/agent-plugins/conversation-normalize";

describe("normalizeConversationHistory", () => {
  it("returns empty for non-arrays", () => {
    expect(normalizeConversationHistory(undefined)).toEqual([]);
    expect(normalizeConversationHistory({})).toEqual([]);
  });

  it("keeps only user/assistant with string content", () => {
    expect(
      normalizeConversationHistory([
        { role: "user", content: "hi" },
        { role: "system", content: "no" },
        { role: "assistant", content: "hello" },
        { role: "user", content: 1 },
      ] as unknown[])
    ).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });
});

describe("normalizeAgentConversationContext", () => {
  it("returns empty context for null", () => {
    expect(normalizeAgentConversationContext(null)).toEqual({
      priorMessages: [],
      userMessage: "",
    });
  });

  it("normalizes nested history and loop slices", () => {
    const o = {
      priorMessages: [{ role: "user", content: "a" }],
      userMessage: "yes",
      currentLoopAssistantTurns: ["Asked for confirmation"],
    };
    expect(normalizeAgentConversationContext(o)).toEqual(o);
  });

  it("drops invalid loop turns", () => {
    expect(
      normalizeAgentConversationContext({
        priorMessages: [],
        userMessage: "x",
        currentLoopAssistantTurns: [1, "ok", null],
      } as unknown)
    ).toEqual({
      priorMessages: [],
      userMessage: "x",
      currentLoopAssistantTurns: ["ok"],
    });
  });
});
