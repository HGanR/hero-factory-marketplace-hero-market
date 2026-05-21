import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  executiveOperationalThreadMessages,
  executiveOperationalThreads,
} from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import {
  buildSkipperThreadAwarenessLines,
  formatSkipperThreadContext,
  normalizeDepartment,
  type CreateOperationalThreadInput,
  type ExecutiveOperationalThreadDetailDto,
  type ExecutiveOperationalThreadDto,
  type ExecutiveOperationalThreadMessageDto,
  type ExecutiveOperationalThreadsListDto,
  type ListOperationalThreadsFilter,
  type PostOperationalThreadMessageInput,
} from "@/lib/executive-agent/executive-conversation-threads";
import { isExecutiveSubjectId, type ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import {
  approvalDiscussionThreadKind,
  buildApprovalDiscussionThreadTitle,
} from "@/lib/executive-agent/approval-thread-linking";
import {
  buildFulfillmentCaseThreadTitle,
  fulfillmentCaseThreadKind,
  fulfillmentThreadSubjectId,
} from "@/lib/executive-agent/fulfillment-thread-linking";
import { buildThreadMemorySummary } from "@/lib/executive-agent/thread-memory-summary";
import { operationalThreadsToTimelineEntries } from "@/lib/executive-agent/executive-conversation-threads";

export { operationalThreadsToTimelineEntries };

type Db = MySql2Database<typeof schema>;

function rowToThreadDto(row: typeof executiveOperationalThreads.$inferSelect): ExecutiveOperationalThreadDto {
  const subjectId = row.subjectId?.trim() ?? null;
  return {
    id: row.id,
    title: row.title,
    threadKind: row.threadKind,
    status: row.status,
    priority: row.priority,
    subjectId: subjectId && isExecutiveSubjectId(subjectId) ? subjectId : null,
    department: normalizeDepartment(row.department),
    clientId: row.clientId?.trim() ?? null,
    orderId: row.orderId?.trim() ?? null,
    approvalId: row.approvalId?.trim() ?? null,
    decisionNeeded: row.decisionNeeded,
    pinnedNoteText: row.pinnedNoteText?.trim() ?? null,
    memorySummary: row.memorySummary?.trim() ?? null,
    unresolvedQuestionCount: row.unresolvedQuestionCount,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToMessageDto(
  row: typeof executiveOperationalThreadMessages.$inferSelect
): ExecutiveOperationalThreadMessageDto {
  return {
    id: row.id,
    threadId: row.threadId,
    adminUserId: row.adminUserId,
    bodyText: row.bodyText,
    messageKind: row.messageKind,
    priorityTag: row.priorityTag?.trim() ?? null,
    isPinned: row.isPinned,
    ownerOnly: row.ownerOnly,
    createdAt: row.createdAt.toISOString(),
  };
}

async function auditThreadAction(
  db: Db,
  row: {
    adminUserId: number;
    actionType: string;
    targetType: string;
    targetId: string;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown>;
  }
): Promise<void> {
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: row.adminUserId,
    prompt: null,
    toolName: "executive_operational_threads",
    actionType: row.actionType,
    targetType: row.targetType,
    targetId: row.targetId,
    inputJson: row.inputJson ? JSON.stringify(row.inputJson).slice(0, 50_000) : null,
    outputJson: row.outputJson ? JSON.stringify(row.outputJson).slice(0, 50_000) : null,
    approvalStatus: "not_required",
  });
}

export async function listExecutiveOperationalThreads(
  db: Db,
  input: { adminUserId: number } & ListOperationalThreadsFilter
): Promise<ExecutiveOperationalThreadsListDto> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const conditions = [eq(executiveOperationalThreads.adminUserId, input.adminUserId)];

  if (input.subjectId?.trim()) {
    conditions.push(eq(executiveOperationalThreads.subjectId, input.subjectId.trim()));
  }
  if (input.clientId?.trim()) {
    conditions.push(eq(executiveOperationalThreads.clientId, input.clientId.trim()));
  }
  if (input.orderId?.trim()) {
    conditions.push(eq(executiveOperationalThreads.orderId, input.orderId.trim()));
  }
  if (input.approvalId?.trim()) {
    conditions.push(eq(executiveOperationalThreads.approvalId, input.approvalId.trim()));
  }
  if (input.threadKind) {
    conditions.push(eq(executiveOperationalThreads.threadKind, input.threadKind));
  }
  if (input.status) {
    conditions.push(eq(executiveOperationalThreads.status, input.status));
  }
  if (input.decisionNeeded === true) {
    conditions.push(eq(executiveOperationalThreads.decisionNeeded, true));
  }

  const rows = await db
    .select()
    .from(executiveOperationalThreads)
    .where(and(...conditions))
    .orderBy(
      desc(executiveOperationalThreads.decisionNeeded),
      desc(executiveOperationalThreads.priority),
      desc(executiveOperationalThreads.lastMessageAt),
      desc(executiveOperationalThreads.updatedAt)
    )
    .limit(limit);

  const threads = rows.map(rowToThreadDto);

  const openQuestions: string[] = [];
  const pendingDecisions: Array<{ threadId: string; title: string; approvalId: string | null }> = [];

  for (const t of threads) {
    if (t.unresolvedQuestionCount > 0 && t.memorySummary) {
      openQuestions.push(t.memorySummary.slice(0, 200));
    }
    if (t.decisionNeeded) {
      pendingDecisions.push({
        threadId: t.id,
        title: t.title,
        approvalId: t.approvalId,
      });
    }
  }

  const activeDiscussion =
    threads.find((t) => t.status === "open" || t.status === "monitoring") ?? threads[0] ?? null;

  const skipperLines = buildSkipperThreadAwarenessLines({
    activeThread: activeDiscussion,
    threads,
    unresolvedQuestions: openQuestions,
    pendingDecisions: pendingDecisions.map((d) => ({ threadId: d.threadId, title: d.title })),
    relatedOrderId: input.orderId ?? null,
    relatedApprovalId: input.approvalId ?? null,
  });

  await auditThreadAction(db, {
    adminUserId: input.adminUserId,
    actionType: "list_threads",
    targetType: "executive_operational_threads",
    targetId: input.subjectId ?? input.orderId ?? "all",
    inputJson: {
      subjectId: input.subjectId,
      orderId: input.orderId,
      approvalId: input.approvalId,
      limit,
    },
    outputJson: { count: threads.length },
  });

  return {
    ok: true,
    threads,
    activeDiscussion,
    unresolvedQuestions: openQuestions,
    pendingDecisions,
    skipperThreadContext: formatSkipperThreadContext(skipperLines),
    generatedAt: new Date().toISOString(),
  };
}

export async function getExecutiveOperationalThreadDetail(
  db: Db,
  input: { adminUserId: number; threadId: string; messageLimit?: number }
): Promise<ExecutiveOperationalThreadDetailDto | { ok: false; error: string }> {
  const [row] = await db
    .select()
    .from(executiveOperationalThreads)
    .where(
      and(
        eq(executiveOperationalThreads.id, input.threadId),
        eq(executiveOperationalThreads.adminUserId, input.adminUserId)
      )
    )
    .limit(1);

  if (!row) return { ok: false, error: "thread_not_found" };

  const msgLimit = Math.min(Math.max(input.messageLimit ?? 80, 1), 200);
  const msgRows = await db
    .select()
    .from(executiveOperationalThreadMessages)
    .where(eq(executiveOperationalThreadMessages.threadId, input.threadId))
    .orderBy(desc(executiveOperationalThreadMessages.createdAt))
    .limit(msgLimit);

  const messages = msgRows.map(rowToMessageDto).reverse();
  const thread = rowToThreadDto(row);

  const timelineEntries = messages.map((m) => ({
    id: m.id,
    label: `[${m.messageKind}] ${thread.title}`,
    occurredAt: m.createdAt,
    detail: m.bodyText.slice(0, 400),
  }));

  const skipperLines = buildSkipperThreadAwarenessLines({
    activeThread: thread,
    threads: [thread],
    unresolvedQuestions: messages.filter((m) => m.messageKind === "question").map((m) => m.bodyText),
    pendingDecisions: thread.decisionNeeded
      ? [{ threadId: thread.id, title: thread.title }]
      : [],
    relatedOrderId: thread.orderId,
    relatedApprovalId: thread.approvalId,
  });

  await auditThreadAction(db, {
    adminUserId: input.adminUserId,
    actionType: "read_thread",
    targetType: "executive_operational_thread",
    targetId: input.threadId,
  });

  return {
    ok: true,
    thread,
    messages,
    timelineEntries,
    skipperThreadContext: formatSkipperThreadContext(skipperLines),
    generatedAt: new Date().toISOString(),
  };
}

async function refreshThreadMemory(db: Db, threadId: string, adminUserId: number): Promise<void> {
  const [threadRow] = await db
    .select()
    .from(executiveOperationalThreads)
    .where(
      and(
        eq(executiveOperationalThreads.id, threadId),
        eq(executiveOperationalThreads.adminUserId, adminUserId)
      )
    )
    .limit(1);
  if (!threadRow) return;

  const msgRows = await db
    .select()
    .from(executiveOperationalThreadMessages)
    .where(eq(executiveOperationalThreadMessages.threadId, threadId))
    .orderBy(desc(executiveOperationalThreadMessages.createdAt))
    .limit(40);

  const messages = msgRows.map(rowToMessageDto).reverse();
  const thread = rowToThreadDto(threadRow);
  const mem = buildThreadMemorySummary({ thread, messages });

  await db
    .update(executiveOperationalThreads)
    .set({
      memorySummary: mem.summary,
      unresolvedQuestionCount: mem.unresolvedQuestionCount,
      updatedAt: sql`NOW()`,
    })
    .where(eq(executiveOperationalThreads.id, threadId));
}

export async function createExecutiveOperationalThread(
  db: Db,
  input: { adminUserId: number } & CreateOperationalThreadInput
): Promise<{ ok: true; thread: ExecutiveOperationalThreadDto }> {
  const id = randomUUID();
  const now = new Date();
  const subjectId =
    input.subjectId?.trim() && isExecutiveSubjectId(input.subjectId.trim())
      ? (input.subjectId.trim() as ExecutiveSubjectId)
      : null;

  await db.insert(executiveOperationalThreads).values({
    id,
    adminUserId: input.adminUserId,
    title: input.title.trim().slice(0, 500),
    threadKind: input.threadKind,
    status: input.status ?? "open",
    priority: input.priority ?? "normal",
    subjectId,
    department: input.department ?? null,
    clientId: input.clientId?.trim() ?? null,
    orderId: input.orderId?.trim() ?? null,
    approvalId: input.approvalId?.trim() ?? null,
    decisionNeeded: input.decisionNeeded ?? false,
    pinnedNoteText: input.pinnedNoteText?.trim() ?? null,
    memorySummary: null,
    unresolvedQuestionCount: 0,
    lastMessageAt: null,
    createdAt: now,
    updatedAt: now,
  });

  if (input.initialMessage?.trim()) {
    await postExecutiveOperationalThreadMessage(db, {
      adminUserId: input.adminUserId,
      threadId: id,
      bodyText: input.initialMessage.trim(),
      messageKind: "discussion",
    });
  } else {
    await refreshThreadMemory(db, id, input.adminUserId);
  }

  const [row] = await db
    .select()
    .from(executiveOperationalThreads)
    .where(eq(executiveOperationalThreads.id, id))
    .limit(1);

  const thread = rowToThreadDto(row!);

  await auditThreadAction(db, {
    adminUserId: input.adminUserId,
    actionType: "create_thread",
    targetType: "executive_operational_thread",
    targetId: id,
    inputJson: {
      threadKind: input.threadKind,
      orderId: input.orderId,
      approvalId: input.approvalId,
    },
  });

  return { ok: true, thread };
}

export async function postExecutiveOperationalThreadMessage(
  db: Db,
  input: { adminUserId: number; threadId: string } & PostOperationalThreadMessageInput
): Promise<{ ok: true; message: ExecutiveOperationalThreadMessageDto } | { ok: false; error: string }> {
  const [threadRow] = await db
    .select()
    .from(executiveOperationalThreads)
    .where(
      and(
        eq(executiveOperationalThreads.id, input.threadId),
        eq(executiveOperationalThreads.adminUserId, input.adminUserId)
      )
    )
    .limit(1);

  if (!threadRow) return { ok: false, error: "thread_not_found" };

  const body = input.bodyText.trim();
  if (!body) return { ok: false, error: "empty_body" };

  const id = randomUUID();
  const now = new Date();
  const messageKind = input.messageKind ?? "discussion";

  await db.insert(executiveOperationalThreadMessages).values({
    id,
    threadId: input.threadId,
    adminUserId: input.adminUserId,
    bodyText: body.slice(0, 20_000),
    messageKind,
    priorityTag: input.priorityTag?.trim() ?? null,
    isPinned: input.isPinned ?? false,
    ownerOnly: input.ownerOnly ?? false,
    metadataJson: null,
    createdAt: now,
  });

  const unresolved = messageKind === "question" ? threadRow.unresolvedQuestionCount + 1 : threadRow.unresolvedQuestionCount;
  const decisionNeeded =
    threadRow.decisionNeeded || messageKind === "decision_request" || input.priorityTag === "decision-needed";

  if (input.isPinned) {
    await db
      .update(executiveOperationalThreads)
      .set({ pinnedNoteText: body.slice(0, 4000) })
      .where(eq(executiveOperationalThreads.id, input.threadId));
  }

  await db
    .update(executiveOperationalThreads)
    .set({
      lastMessageAt: now,
      unresolvedQuestionCount: unresolved,
      decisionNeeded,
      updatedAt: now,
    })
    .where(eq(executiveOperationalThreads.id, input.threadId));

  await refreshThreadMemory(db, input.threadId, input.adminUserId);

  const [msgRow] = await db
    .select()
    .from(executiveOperationalThreadMessages)
    .where(eq(executiveOperationalThreadMessages.id, id))
    .limit(1);

  await auditThreadAction(db, {
    adminUserId: input.adminUserId,
    actionType: "post_message",
    targetType: "executive_operational_thread_message",
    targetId: id,
    inputJson: { threadId: input.threadId, messageKind, ownerOnly: input.ownerOnly },
  });

  return { ok: true, message: rowToMessageDto(msgRow!) };
}

export async function findOrCreateFulfillmentCaseThread(
  db: Db,
  input: {
    adminUserId: number;
    orderId: string;
    clientId?: string | null;
    department: "WEBSITE" | "TRUST";
    stageLabel?: string | null;
  }
): Promise<ExecutiveOperationalThreadDto> {
  const [existing] = await db
    .select()
    .from(executiveOperationalThreads)
    .where(
      and(
        eq(executiveOperationalThreads.adminUserId, input.adminUserId),
        eq(executiveOperationalThreads.orderId, input.orderId.trim()),
        eq(executiveOperationalThreads.threadKind, fulfillmentCaseThreadKind())
      )
    )
    .limit(1);

  if (existing) return rowToThreadDto(existing);

  const created = await createExecutiveOperationalThread(db, {
    adminUserId: input.adminUserId,
    title: buildFulfillmentCaseThreadTitle({
      orderId: input.orderId,
      clientId: input.clientId,
      department: input.department,
      stageLabel: input.stageLabel,
    }),
    threadKind: fulfillmentCaseThreadKind(),
    subjectId: fulfillmentThreadSubjectId(input.department),
    department: input.department,
    clientId: input.clientId,
    orderId: input.orderId,
    priority: "normal",
  });
  return created.thread;
}

export async function findOrCreateApprovalDiscussionThread(
  db: Db,
  input: {
    adminUserId: number;
    approvalId: string;
    proposedAction: string;
    targetType?: string | null;
    targetId?: string | null;
  }
): Promise<ExecutiveOperationalThreadDto> {
  const [existing] = await db
    .select()
    .from(executiveOperationalThreads)
    .where(
      and(
        eq(executiveOperationalThreads.adminUserId, input.adminUserId),
        eq(executiveOperationalThreads.approvalId, input.approvalId.trim()),
        eq(executiveOperationalThreads.threadKind, approvalDiscussionThreadKind())
      )
    )
    .limit(1);

  if (existing) return rowToThreadDto(existing);

  const created = await createExecutiveOperationalThread(db, {
    adminUserId: input.adminUserId,
    title: buildApprovalDiscussionThreadTitle(input),
    threadKind: approvalDiscussionThreadKind(),
    approvalId: input.approvalId,
    decisionNeeded: true,
    priority: "high",
    initialMessage: `Internal approval discussion for ${input.proposedAction}. Human decision required — no autonomous execution.`,
  });
  return created.thread;
}

/** Read-only context bundle for Skipper tools and subject workspace enrichment. */
export async function buildExecutiveOperationalThreadsContext(
  db: Db,
  input: {
    adminUserId: number;
    subjectId?: string | null;
    clientId?: string | null;
    orderId?: string | null;
    approvalId?: string | null;
    limit?: number;
  }
): Promise<ExecutiveOperationalThreadsListDto> {
  return listExecutiveOperationalThreads(db, {
    adminUserId: input.adminUserId,
    subjectId: input.subjectId,
    clientId: input.clientId,
    orderId: input.orderId,
    approvalId: input.approvalId,
    limit: input.limit ?? 30,
  });
}
