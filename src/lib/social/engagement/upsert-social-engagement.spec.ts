import { describe, expect, it } from "@jest/globals";
import {
  socialEngagementAiSuggestions,
  socialEngagementMessages,
  socialEngagementRules,
  socialEngagementThreads,
} from "@/lib/db/schema";
import type { NormalizedEngagementIngest } from "./normalize-engagement-event";
import { upsertSocialEngagementFromIngest } from "./upsert-social-engagement";

type ThreadRow = Record<string, unknown>;
type MessageRow = Record<string, unknown>;

/** In-memory mock matching `upsertSocialEngagementFromIngest` call patterns (no SQL parse). */
function createEngagementIngestMock() {
  const threads = new Map<string, ThreadRow>();
  const threadsById = new Map<string, ThreadRow>();
  const messages = new Map<string, MessageRow>();
  const suggestions: unknown[] = [];

  const threadKey = (socialAccountId: string, externalThreadId: string) => `${socialAccountId}::${externalThreadId}`;

  let gIngest: NormalizedEngagementIngest;
  let activeThreadId = "";

  const setContext = (ingest: NormalizedEngagementIngest) => {
    gIngest = ingest;
  };

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        where: (_cond: unknown) => ({
          limit: async () => {
            if (table === socialEngagementThreads) {
              const k = threadKey(gIngest.socialAccountId, gIngest.externalThreadId);
              const row = threads.get(k) ?? (activeThreadId ? threadsById.get(activeThreadId) : undefined);
              if (row) activeThreadId = String(row.id);
              return row ? [row] : [];
            }
            if (table === socialEngagementRules) {
              return [];
            }
            if (table === socialEngagementMessages) {
              const mk = `${activeThreadId}::${gIngest.message.externalMessageId}`;
              const row = messages.get(mk);
              return row ? [row] : [];
            }
            return [];
          },
        }),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        where: (_cond: unknown) => {
          if (table !== socialEngagementThreads) return Promise.resolve();
          for (const [k, row] of threads) {
            if (String(row.id) === activeThreadId) {
              const next = { ...row, ...values };
              threads.set(k, next);
              threadsById.set(String(row.id), next);
              break;
            }
          }
          return Promise.resolve();
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        if (table === socialEngagementThreads) {
          const sid = String(values.socialAccountId);
          const ext = String(values.externalThreadId);
          const row = { ...values };
          threads.set(threadKey(sid, ext), row);
          threadsById.set(String(values.id), row);
          activeThreadId = String(values.id);
        } else if (table === socialEngagementMessages) {
          const tid = String(values.threadId);
          activeThreadId = tid;
          const mid = String(values.externalMessageId);
          messages.set(`${tid}::${mid}`, { ...values });
        } else if (table === socialEngagementAiSuggestions) {
          suggestions.push(values);
        }
      },
    }),
  };

  return { db, setContext, get threads() {
    return threads;
  }, get messages() {
    return messages;
  } };
}

function sampleIngest(overrides: Partial<NormalizedEngagementIngest> = {}): NormalizedEngagementIngest {
  return {
    userId: "u1",
    clientId: "c1",
    campaignId: null,
    socialAccountId: "sa-1",
    provider: "meta",
    externalThreadId: "ext-th-1",
    sourceType: "comment",
    lastMessageAt: new Date("2026-01-01T12:00:00Z"),
    previewText: "hi",
    message: {
      externalMessageId: "m-1",
      direction: "inbound",
      authorDisplay: "A",
      messageText: "Hello there",
      createdAt: new Date("2026-01-01T12:00:00Z"),
      rawPayload: {},
    },
    metadataJson: null,
    ...overrides,
  };
}

const opt = {
  flagsOverride: { canReadComments: true, canReplyComments: true, canReadDMs: true, canSendDMs: true },
  socialAccount: null,
};

describe("upsertSocialEngagementFromIngest", () => {
  it("is idempotent on same account + thread + message: second call returns isNew false and one message", async () => {
    const { db, setContext, messages } = createEngagementIngestMock();
    const input = sampleIngest();
    setContext(input);
    const r1 = await upsertSocialEngagementFromIngest(db, input, opt);
    setContext(input);
    const r2 = await upsertSocialEngagementFromIngest(db, input, opt);
    expect(r1.isNew).toBe(true);
    expect(r2.isNew).toBe(false);
    expect(r1.threadId).toBe(r2.threadId);
    expect([...messages.values()].filter((m) => m.threadId === r1.threadId).length).toBe(1);
  });

  it("inserts a second message when external message id changes", async () => {
    const { db, setContext, messages } = createEngagementIngestMock();
    const input = sampleIngest();
    setContext(input);
    const r1 = await upsertSocialEngagementFromIngest(db, input, opt);
    const input2 = { ...input, message: { ...input.message, externalMessageId: "m-2", messageText: "second" } };
    setContext(input2);
    await upsertSocialEngagementFromIngest(db, input2, opt);
    expect([...messages.values()].filter((m) => m.threadId === r1.threadId).length).toBe(2);
  });
});
