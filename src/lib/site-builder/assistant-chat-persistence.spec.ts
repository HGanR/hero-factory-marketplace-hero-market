import { describe, expect, it } from "@jest/globals";
import {
  assistantSemanticBucket,
  CHAT_FULL_BUILD_SUCCESS,
  filterChatMessagesForStorage,
  isNonPersistableAssistantEcho,
  shouldPersistChatMessage,
  shouldSkipConsecutiveChatMessage,
} from "@/lib/site-builder/assistant-chat-persistence";

describe("assistant-chat-persistence", () => {
  it("does not persist legacy generic assistant echoes", () => {
    expect(
      shouldPersistChatMessage({
        role: "assistant",
        content: "Your site is in the preview. Keep editing with natural language below.",
      }),
    ).toBe(false);
    expect(isNonPersistableAssistantEcho("The build didn’t finish—check the error above and try again.")).toBe(true);
    expect(shouldPersistChatMessage({ role: "assistant", content: CHAT_FULL_BUILD_SUCCESS })).toBe(true);
  });

  it("does not persist error/status/debug roles", () => {
    expect(shouldPersistChatMessage({ role: "error", content: "Build didn’t finish: timeout" })).toBe(false);
    expect(shouldPersistChatMessage({ role: "status", content: "Working" })).toBe(false);
  });

  it("dedupes consecutive identical messages", () => {
    const prev = [{ id: "1", role: "assistant" as const, content: "Hello", at: 1 }];
    expect(shouldSkipConsecutiveChatMessage(prev, "assistant", "Hello")).toBe(true);
    expect(shouldSkipConsecutiveChatMessage(prev, "assistant", "Hello world")).toBe(false);
  });

  it("dedupes consecutive assistant messages in the same semantic success family", () => {
    const prev = [
      { id: "1", role: "assistant" as const, content: CHAT_FULL_BUILD_SUCCESS, at: 1 },
    ];
    expect(
      shouldSkipConsecutiveChatMessage(prev, "assistant", "A few layout options are ready—pick one to load the preview."),
    ).toBe(true);
  });

  it("does not dedupe different failure details", () => {
    const prev = [
      { id: "1", role: "assistant" as const, content: "The build didn’t finish: network", at: 1 },
    ];
    expect(shouldSkipConsecutiveChatMessage(prev, "assistant", "The build didn’t finish: timeout")).toBe(false);
  });

  it("dedupes consecutive identical error lines", () => {
    const prev = [{ id: "1", role: "error" as const, content: "Build didn’t finish: timeout", at: 1 }];
    expect(shouldSkipConsecutiveChatMessage(prev, "error", "Build didn’t finish: timeout")).toBe(true);
  });

  it("filterChatMessagesForStorage drops non-persistable and consecutive dupes", () => {
    const input = [
      { id: "u1", role: "user" as const, content: "Go", at: 1 },
      { id: "a1", role: "assistant" as const, content: "Your site is in the preview. Keep editing.", at: 2 },
      { id: "a2", role: "assistant" as const, content: CHAT_FULL_BUILD_SUCCESS, at: 3 },
      { id: "a3", role: "assistant" as const, content: CHAT_FULL_BUILD_SUCCESS, at: 4 },
      { id: "e1", role: "error" as const, content: "Build didn’t finish: x", at: 5 },
    ];
    const out = filterChatMessagesForStorage(input);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(out[1]!.content).toBe(CHAT_FULL_BUILD_SUCCESS);
  });

  it("assistantSemanticBucket classifies success family", () => {
    expect(assistantSemanticBucket(CHAT_FULL_BUILD_SUCCESS)).toBe("build_success_family");
    expect(assistantSemanticBucket("Layout options are ready—choose one to continue.")).toBe("build_success_family");
  });

  it("storage layer does not imply intelligence writes (orthogonal lists)", () => {
    expect(filterChatMessagesForStorage([])).toEqual([]);
  });
});
