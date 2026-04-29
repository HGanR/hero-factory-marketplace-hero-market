import { describe, expect, it } from "@jest/globals";
import { coalesceEventTimestamp, engagementIngestEventFingerprint, normalizeEngagementEvent } from "./normalize-engagement-event";

const ctx = { userId: "u1", clientId: "c1", socialAccountId: "sa1", provider: "meta" };

describe("normalizeEngagementEvent", () => {
  it("normalizes a minimal event", () => {
    const n = normalizeEngagementEvent(
      {
        externalThreadId: "t1",
        sourceType: "comment",
        message: {
          externalMessageId: "m1",
          direction: "inbound",
          messageText: "Hello",
        },
      },
      ctx
    );
    expect(n.externalThreadId).toBe("t1");
    expect(n.message.externalMessageId).toBe("m1");
    expect(n.sourceType).toBe("comment");
  });

  it("throws on missing thread id", () => {
    expect(() => normalizeEngagementEvent({ sourceType: "comment", message: { externalMessageId: "a", messageText: "x" } }, ctx)).toThrow("externalThreadId");
  });

  it("engagementIngestEventFingerprint is deterministic", () => {
    const a = engagementIngestEventFingerprint({ provider: "meta", externalThreadId: "t", externalMessageId: "m" });
    const b = engagementIngestEventFingerprint({ provider: "meta", externalThreadId: "t", externalMessageId: "m" });
    expect(a).toBe(b);
    expect(a.length).toBe(32);
  });

  it("coalesceEventTimestamp falls back for invalid", () => {
    const t = coalesceEventTimestamp("not-a-date", "message.createdAt");
    expect(t.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
