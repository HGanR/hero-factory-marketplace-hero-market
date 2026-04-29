/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  appendWidgetMessage,
  extractOriginHost,
  getOrResumeWidgetConversation,
} from "@/lib/widget/widget-conversation-service";
import { ensureWidgetConversationTables } from "@/lib/db/widget-conversation-ensure";

jest.mock("@/lib/db/widget-conversation-ensure", () => ({
  ensureWidgetConversationTables: jest.fn().mockResolvedValue(undefined),
}));

describe("extractOriginHost", () => {
  it("prefers Origin header host", () => {
    expect(extractOriginHost("https://app.example.com", "https://other.com/page")).toBe("app.example.com");
  });

  it("falls back to Referer", () => {
    expect(extractOriginHost("", "https://referer.test/path")).toBe("referer.test");
  });
});

describe("getOrResumeWidgetConversation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a new row when no prior public id matches", async () => {
    const inserted: Record<string, unknown>[] = [];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          inserted.push(v);
          return Promise.resolve();
        },
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    };

    const r = await getOrResumeWidgetConversation(db as never, {
      bindingId: "b1",
      widgetKey: "wk123456789012345678",
      siteId: "s1",
      agentId: "a1",
      ownerUserId: 42,
      siteVersionIdSnapshot: null,
      providerStrategy: "agent",
      publicConversationIdFromClient: undefined,
      sessionId: "sess",
      originHost: "example.com",
      visitorId: null,
    });

    expect(r.resumed).toBe(false);
    expect(r.publicId.length).toBeGreaterThan(16);
    expect(inserted.length).toBe(1);
    expect(inserted[0].widgetBindingId).toBe("b1");
    expect(ensureWidgetConversationTables).toHaveBeenCalled();
  });

  it("resumes when public id matches binding", async () => {
    const existing = {
      id: "int-1",
      publicConversationId: "existing-pub",
      widgetBindingId: "b1",
      status: "active",
    };
    let updated = false;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([existing]),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => {
            updated = true;
            return Promise.resolve();
          },
        }),
      }),
    };

    const r = await getOrResumeWidgetConversation(db as never, {
      bindingId: "b1",
      widgetKey: "wk",
      siteId: "s1",
      agentId: "a1",
      ownerUserId: 1,
      siteVersionIdSnapshot: null,
      providerStrategy: "agent",
      publicConversationIdFromClient: "existing-pub",
      sessionId: null,
      originHost: null,
      visitorId: null,
    });

    expect(r.resumed).toBe(true);
    expect(r.publicId).toBe("existing-pub");
    expect(updated).toBe(true);
  });
});

describe("appendWidgetMessage", () => {
  it("inserts and bumps conversation timestamp", async () => {
    const inserted: unknown[] = [];
    let convUpdated = false;
    const db = {
      insert: () => ({
        values: (v: unknown) => {
          inserted.push(v);
          return Promise.resolve();
        },
      }),
      update: () => ({
        set: () => ({
          where: () => {
            convUpdated = true;
            return Promise.resolve();
          },
        }),
      }),
    };

    await appendWidgetMessage(db as never, {
      conversationInternalId: "c1",
      role: "assistant",
      contentText: "hello",
      status: "ok",
    });

    expect(inserted.length).toBe(1);
    expect(convUpdated).toBe(true);
  });
});
