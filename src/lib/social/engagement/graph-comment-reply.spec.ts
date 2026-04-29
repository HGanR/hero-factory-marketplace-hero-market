import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { getGraphParentCommentIdFromThreadMetadata, postGraphCommentReply } from "./graph-comment-reply";

describe("getGraphParentCommentIdFromThreadMetadata", () => {
  it("reads engagement.graphParentCommentId", () => {
    const id = getGraphParentCommentIdFromThreadMetadata({ engagement: { graphParentCommentId: "c123" } });
    expect(id).toBe("c123");
  });
  it("returns null when missing", () => {
    expect(getGraphParentCommentIdFromThreadMetadata({})).toBeNull();
  });
});

describe("postGraphCommentReply", () => {
  const fetch0 = globalThis.fetch;
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = jest.fn() as any;
  });
  afterEach(() => {
    globalThis.fetch = fetch0;
  });
  it("returns ok with platform id on 200", async () => {
    (globalThis.fetch as ReturnType<typeof jest.fn>).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ id: "reply-99" }),
    });
    const r = await postGraphCommentReply({ accessToken: "t", parentCommentId: "c1", message: "Thanks!" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.platformReplyId).toBe("reply-99");
  });
  it("fails on empty message", async () => {
    const r = await postGraphCommentReply({ accessToken: "t", parentCommentId: "c1", message: "  " });
    expect(r.ok).toBe(false);
  });
});
