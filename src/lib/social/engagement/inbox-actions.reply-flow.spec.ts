/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { randomUUID } from "crypto";
import { inboxReplyToThreadComment } from "./inbox-actions";
import * as graphReply from "./graph-comment-reply";
import * as encrypt from "@/lib/social/encrypt";
import {
  campaignAuditEvents,
  socialAccountCapabilities,
  socialAccounts,
  socialEngagementMessages,
  socialEngagementThreads,
} from "@/lib/db/schema";

jest.mock("@/lib/social/encrypt", () => ({
  decryptToken: jest.fn(),
}));

jest.mock("@/lib/social/engagement/graph-comment-reply", () => {
  const actual = jest.requireActual("@/lib/social/engagement/graph-comment-reply") as typeof graphReply;
  return {
    ...actual,
    postGraphCommentReply: jest.fn(),
  };
});

const threadId = randomUUID();
const accId = randomUUID();
const userId = "user-1";
const clientId = "client-1";

function baseThread(over: Record<string, unknown> = {}) {
  return {
    id: threadId,
    userId,
    clientId,
    socialAccountId: accId,
    provider: "meta",
    externalThreadId: "ext-1",
    sourceType: "comment",
    status: "new",
    requiresManual: false,
    lastMessageAt: new Date(),
    metadataJson: { graphParentCommentId: "parent-99", engagement: { graphParentCommentId: "parent-99" } },
    campaignId: null,
    intent: null,
    sentiment: null,
    urgency: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function memDb(initial: { thread: Record<string, unknown>; account: Record<string, unknown> }) {
  const threads = new Map([[threadId, { ...initial.thread }]]);
  const accounts = new Map([[accId, { ...initial.account }]]);
  const caps: Record<string, unknown> = { [accId]: { flagsJson: { canReadComments: true, canReplyComments: true, canReadDMs: true, canSendDMs: false } } };
  const messages: unknown[] = [];
  const audits: unknown[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          limit: () => {
            if (table === socialEngagementThreads) {
              return Promise.resolve([threads.get(threadId)].filter(Boolean));
            }
            if (table === socialAccounts) {
              return Promise.resolve([accounts.get(accId)].filter(Boolean));
            }
            if (table === socialAccountCapabilities) {
              return Promise.resolve(caps[accId] ? [caps[accId]] : []);
            }
            return Promise.resolve([]);
          },
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (row: Record<string, unknown>) => {
        if (table === socialEngagementMessages) {
          messages.push(row);
        }
        if (table === campaignAuditEvents) {
          audits.push(row);
        }
      },
    }),
    update: (table: unknown) => ({
      set: (vals: Record<string, unknown>) => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        where: async (_c: unknown) => {
          if (table === socialEngagementThreads && threads.has(threadId)) {
            Object.assign(threads.get(threadId)!, vals, { updatedAt: new Date() });
          }
        },
      }),
    }),
  };
  return { db, messages, audits, threads };
}

describe("inboxReplyToThreadComment (governance + Graph path)", () => {
  const decrypt = encrypt.decryptToken as jest.MockedFunction<typeof encrypt.decryptToken>;
  const post = graphReply.postGraphCommentReply as jest.MockedFunction<typeof graphReply.postGraphCommentReply>;
  const prevBlock = process.env.REVENUE_OS_INBOX_BLOCK_REPLIES;
  const prevAppr = process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL;
  const prevList = process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS;

  beforeEach(() => {
    process.env.REVENUE_OS_INBOX_BLOCK_REPLIES = "0";
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL = "0";
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS = "";
    jest.clearAllMocks();
    decrypt.mockReturnValue("token-1");
  });

  afterEach(() => {
    process.env.REVENUE_OS_INBOX_BLOCK_REPLIES = prevBlock;
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL = prevAppr;
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS = prevList;
  });

  it("Case A: direct Graph path persists outbound + audit", async () => {
    const { db, messages, audits } = memDb({
      thread: baseThread(),
      account: { id: accId, userId, clientId, platform: "meta", accessTokenEnc: "enc" },
    });
    post.mockResolvedValue({ ok: true, platformReplyId: "g-reply-1" });
    const r = await inboxReplyToThreadComment(db, {
      userId,
      threadId,
      socialAccountId: accId,
      messageId: null,
      replyText: "Hello from inbox",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.heldForApproval).toBeFalsy();
      expect(r.platformReplyId).toBe("g-reply-1");
    }
    expect(decrypt).toHaveBeenCalled();
    expect(post).toHaveBeenCalled();
    expect(messages.some((m) => (m as { direction: string }).direction === "outbound")).toBe(true);
    expect(audits.some((a) => (a as { action: string }).action === "inbox_comment_reply")).toBe(true);
  });

  it("Case B: approval_queue saves note + audit, no Graph", async () => {
    process.env.REVENUE_OS_INBOX_REPLY_REQUIRE_APPROVAL_CLIENT_IDS = clientId;
    const { db, messages, audits } = memDb({
      thread: baseThread(),
      account: { id: accId, userId, clientId, platform: "meta", accessTokenEnc: "enc" },
    });
    const r = await inboxReplyToThreadComment(db, {
      userId,
      threadId,
      socialAccountId: accId,
      messageId: null,
      replyText: "Queue me",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.heldForApproval).toBe(true);
    }
    expect(post).not.toHaveBeenCalled();
    const note = messages.find(
      (m) => (m as { messageText: string }).messageText?.includes("[PENDING INBOX REPLY")
    ) as { messageText: string } | undefined;
    expect(note?.messageText).toContain("Queue me");
    expect(audits.some((a) => (a as { action: string }).action === "inbox_reply_queued_approval")).toBe(true);
  });

  it("Case C: missing parent + token path returns requiresManual and does not call Graph", async () => {
    const { db } = memDb({
      thread: baseThread({ metadataJson: {} }),
      account: { id: accId, userId, clientId, platform: "meta", accessTokenEnc: "enc" },
    });
    const r = await inboxReplyToThreadComment(db, {
      userId,
      threadId,
      socialAccountId: accId,
      messageId: null,
      replyText: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok && "reason" in r) {
      expect(r.requiresManual).toBe(true);
      expect(r.reason).toMatch(/graph|parent|native/i);
    }
    expect(post).not.toHaveBeenCalled();
  });
});
