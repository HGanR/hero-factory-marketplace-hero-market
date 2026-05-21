import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSkipperThreadAwarenessLines,
  countUnresolvedQuestions,
  formatSkipperThreadContext,
} from "@/lib/executive-agent/executive-conversation-threads";
import {
  approvalThreadLinkKey,
  buildApprovalDiscussionThreadTitle,
} from "@/lib/executive-agent/approval-thread-linking";
import {
  buildFulfillmentCaseThreadTitle,
  fulfillmentThreadLinkKey,
} from "@/lib/executive-agent/fulfillment-thread-linking";
import { buildThreadMemorySummary, summarizeThreadsForSkipper } from "@/lib/executive-agent/thread-memory-summary";
import { operationalThreadsToTimelineEntries } from "@/lib/executive-agent/executive-conversation-threads";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";

describe("fulfillment thread linking", () => {
  it("builds case title and link key", () => {
    const title = buildFulfillmentCaseThreadTitle({
      orderId: "order-abc-123456",
      department: "WEBSITE",
      stageLabel: "owner_review",
    });
    assert.match(title, /WEBSITE/);
    assert.match(title, /owner_review/);
    assert.equal(fulfillmentThreadLinkKey("order-abc"), "fulfillment_case:order-abc");
  });
});

describe("approval thread linking", () => {
  it("builds approval title and link key", () => {
    const title = buildApprovalDiscussionThreadTitle({
      approvalId: "appr-1",
      proposedAction: "release_site",
      targetId: "order-xyz-long-id",
    });
    assert.match(title, /release_site/);
    assert.equal(approvalThreadLinkKey("appr-1"), "approval:appr-1");
  });
});

describe("thread memory summary", () => {
  it("summarizes open questions and pinned notes", () => {
    const mem = buildThreadMemorySummary({
      thread: {
        title: "WEBSITE case",
        status: "open",
        priority: "high",
        decisionNeeded: true,
        pinnedNoteText: "Owner must confirm legal copy",
        threadKind: "fulfillment_case",
      },
      messages: [
        { bodyText: "When can we ship?", messageKind: "question", isPinned: false, createdAt: "2026-01-01" },
        { bodyText: "Draft ready", messageKind: "discussion", isPinned: true, createdAt: "2026-01-02" },
      ],
    });
    assert.equal(mem.unresolvedQuestionCount, 1);
    assert.match(mem.summary, /Owner must confirm/);
    assert.match(mem.summary, /Decision needed/);
  });

  it("ranks threads for skipper digest", () => {
    const s = summarizeThreadsForSkipper([
      {
        id: "1",
        title: "Low",
        threadKind: "subject",
        status: "resolved",
        priority: "low",
        subjectId: null,
        department: null,
        clientId: null,
        orderId: null,
        approvalId: null,
        decisionNeeded: false,
        pinnedNoteText: null,
        memorySummary: null,
        unresolvedQuestionCount: 0,
        lastMessageAt: null,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        title: "Urgent decision",
        threadKind: "approval",
        status: "open",
        priority: "urgent",
        subjectId: null,
        department: null,
        clientId: null,
        orderId: null,
        approvalId: "a1",
        decisionNeeded: true,
        pinnedNoteText: null,
        memorySummary: "needs sign-off",
        unresolvedQuestionCount: 2,
        lastMessageAt: null,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    assert.match(s, /Urgent decision/);
  });
});

describe("skipper thread awareness", () => {
  it("formats awareness lines", () => {
    const lines = buildSkipperThreadAwarenessLines({
      activeThread: {
        id: "t1",
        title: "TRUST packet review",
        threadKind: "fulfillment_case",
        status: "open",
        priority: "high",
        subjectId: "trust_jarva",
        department: "TRUST",
        clientId: null,
        orderId: "ord-1",
        approvalId: null,
        decisionNeeded: true,
        pinnedNoteText: null,
        memorySummary: "Legal review pending",
        unresolvedQuestionCount: 1,
        lastMessageAt: null,
        createdAt: "",
        updatedAt: "",
      },
      threads: [],
      unresolvedQuestions: ["Who signs the packet?"],
      pendingDecisions: [{ threadId: "t1", title: "TRUST packet review" }],
      relatedOrderId: "ord-1",
    });
    const ctx = formatSkipperThreadContext(lines);
    assert.match(ctx, /Decision needed/);
    assert.match(ctx, /Unresolved questions/);
    assert.match(ctx, /no client messaging/i);
  });

  it("counts unresolved questions", () => {
    assert.equal(
      countUnresolvedQuestions([
        { messageKind: "question", bodyText: "?" },
        { messageKind: "discussion", bodyText: "ok" },
      ]),
      1
    );
  });
});

describe("timeline integration", () => {
  it("maps thread messages to orchestration timeline entries", () => {
    const entries = operationalThreadsToTimelineEntries({
      threads: [
        {
          id: "t1",
          title: "Case thread",
          threadKind: "fulfillment_case",
          status: "open",
          priority: "normal",
          subjectId: null,
          department: "WEBSITE",
          clientId: null,
          orderId: "ord-1",
          approvalId: null,
          decisionNeeded: false,
          pinnedNoteText: null,
          memorySummary: null,
          unresolvedQuestionCount: 0,
          lastMessageAt: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
      messages: [
        {
          id: "m1",
          threadId: "t1",
          adminUserId: 1,
          bodyText: "Owner noted delay",
          messageKind: "operational_note",
          priorityTag: null,
          isPinned: false,
          ownerOnly: false,
          createdAt: "2026-05-18T12:00:00.000Z",
        },
      ],
    });
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.kind, "orchestration_note");
    assert.match(entries[0]!.label, /Ops thread/);
    assert.equal(entries[0]!.orderId, "ord-1");
  });
});

describe("read tool picker", () => {
  it("selects operational threads tool for thread prompts", () => {
    const tools = pickExecutiveReadTools("What operational threads need a decision?", null);
    assert.ok(tools.includes("getExecutiveOperationalThreads"));
  });
});
