import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  executiveOperationalDecisions,
  executiveOperationalThreadMessages,
  executiveOperationalThreads,
} from "@/lib/db/schema";
import {
  buildSkipperPendingDecisionsContext,
  isDecisionUrgent,
  type ExecutiveOperationalDecisionDto,
  type ExecutivePendingDecisionsDto,
} from "@/lib/executive-agent/executive-operational-decisions";
import { normalizeDepartment } from "@/lib/executive-agent/executive-conversation-threads";
import { isExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";

type Db = MySql2Database<typeof schema>;

export function rowToDecisionDto(
  row: typeof executiveOperationalDecisions.$inferSelect,
  threadTitle?: string | null
): ExecutiveOperationalDecisionDto {
  const subjectId = row.subjectId?.trim() ?? null;
  const deferredUntil = row.deferredUntil ? row.deferredUntil.toISOString() : null;
  const dto: ExecutiveOperationalDecisionDto = {
    id: row.id,
    title: row.title,
    promptSummary: row.promptSummary,
    status: row.status,
    priority: row.priority,
    sourceKind: row.sourceKind,
    threadId: row.threadId?.trim() ?? null,
    questionMessageId: row.questionMessageId?.trim() ?? null,
    promotedFromMessageId: row.promotedFromMessageId?.trim() ?? null,
    approvalId: row.approvalId?.trim() ?? null,
    orderId: row.orderId?.trim() ?? null,
    clientId: row.clientId?.trim() ?? null,
    subjectId: subjectId && isExecutiveSubjectId(subjectId) ? subjectId : null,
    department: normalizeDepartment(row.department),
    decisionText: row.decisionText?.trim() ?? null,
    decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
    decidedByAdminUserId: row.decidedByAdminUserId ?? null,
    deferredUntil,
    deferReason: row.deferReason?.trim() ?? null,
    supersededByDecisionId: row.supersededByDecisionId?.trim() ?? null,
    supersedesDecisionId: row.supersedesDecisionId?.trim() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    threadTitle: threadTitle ?? null,
    urgent: false,
  };
  dto.urgent = isDecisionUrgent(dto);
  return dto;
}

async function existingPromotionForMessage(
  db: Db,
  input: { adminUserId: number; messageId: string }
): Promise<boolean> {
  const [row] = await db
    .select({ id: executiveOperationalDecisions.id })
    .from(executiveOperationalDecisions)
    .where(
      and(
        eq(executiveOperationalDecisions.adminUserId, input.adminUserId),
        or(
          eq(executiveOperationalDecisions.promotedFromMessageId, input.messageId),
          eq(executiveOperationalDecisions.questionMessageId, input.messageId)
        ),
        inArray(executiveOperationalDecisions.status, ["open", "deferred", "decided"])
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function promoteUnresolvedQuestionsForThread(
  db: Db,
  input: { adminUserId: number; threadId: string }
): Promise<number> {
  const [thread] = await db
    .select()
    .from(executiveOperationalThreads)
    .where(
      and(
        eq(executiveOperationalThreads.id, input.threadId),
        eq(executiveOperationalThreads.adminUserId, input.adminUserId)
      )
    )
    .limit(1);
  if (!thread) return 0;

  const messages = await db
    .select()
    .from(executiveOperationalThreadMessages)
    .where(eq(executiveOperationalThreadMessages.threadId, input.threadId))
    .orderBy(desc(executiveOperationalThreadMessages.createdAt))
    .limit(80);

  let created = 0;
  const now = new Date();

  for (const msg of messages) {
    if (msg.messageKind !== "decision_request" && msg.messageKind !== "question") continue;
    const exists = await existingPromotionForMessage(db, {
      adminUserId: input.adminUserId,
      messageId: msg.id,
    });
    if (exists) continue;

    const sourceKind = msg.messageKind === "decision_request" ? "decision_request" : "question";
    const title =
      msg.messageKind === "decision_request"
        ? `Decision request · ${thread.title}`.slice(0, 500)
        : `Open question · ${thread.title}`.slice(0, 500);

    await db.insert(executiveOperationalDecisions).values({
      id: randomUUID(),
      adminUserId: input.adminUserId,
      title,
      promptSummary: msg.bodyText.slice(0, 4000),
      status: "open",
      priority: thread.priority === "urgent" || thread.priority === "high" ? thread.priority : "high",
      sourceKind,
      threadId: thread.id,
      questionMessageId: msg.messageKind === "question" ? msg.id : null,
      promotedFromMessageId: msg.id,
      approvalId: thread.approvalId,
      orderId: thread.orderId,
      clientId: thread.clientId,
      subjectId: thread.subjectId,
      department: thread.department,
      createdAt: now,
      updatedAt: now,
    });
    created += 1;
  }

  return created;
}

export async function promoteUnresolvedQuestionsForAdmin(
  db: Db,
  input: { adminUserId: number; subjectId?: string | null; threadId?: string | null; limit?: number }
): Promise<number> {
  if (input.threadId) {
    return promoteUnresolvedQuestionsForThread(db, {
      adminUserId: input.adminUserId,
      threadId: input.threadId,
    });
  }

  const conditions = [eq(executiveOperationalThreads.adminUserId, input.adminUserId)];
  if (input.subjectId?.trim()) {
    conditions.push(eq(executiveOperationalThreads.subjectId, input.subjectId.trim()));
  }

  const threads = await db
    .select({ id: executiveOperationalThreads.id })
    .from(executiveOperationalThreads)
    .where(and(...conditions))
    .orderBy(desc(executiveOperationalThreads.updatedAt))
    .limit(Math.min(input.limit ?? 40, 80));

  let total = 0;
  for (const t of threads) {
    total += await promoteUnresolvedQuestionsForThread(db, {
      adminUserId: input.adminUserId,
      threadId: t.id,
    });
  }
  return total;
}

export async function listExecutivePendingDecisions(
  db: Db,
  input: {
    adminUserId: number;
    subjectId?: string | null;
    threadId?: string | null;
    orderId?: string | null;
    promote?: boolean;
    limit?: number;
  }
): Promise<ExecutivePendingDecisionsDto> {
  let promotedCount = 0;
  if (input.promote !== false) {
    promotedCount = await promoteUnresolvedQuestionsForAdmin(db, {
      adminUserId: input.adminUserId,
      subjectId: input.subjectId,
      threadId: input.threadId,
    });
  }

  const now = new Date();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const conditions = [eq(executiveOperationalDecisions.adminUserId, input.adminUserId)];

  if (input.threadId?.trim()) {
    conditions.push(eq(executiveOperationalDecisions.threadId, input.threadId.trim()));
  }
  if (input.subjectId?.trim()) {
    conditions.push(eq(executiveOperationalDecisions.subjectId, input.subjectId.trim()));
  }
  if (input.orderId?.trim()) {
    conditions.push(eq(executiveOperationalDecisions.orderId, input.orderId.trim()));
  }

  const rows = await db
    .select({
      decision: executiveOperationalDecisions,
      threadTitle: executiveOperationalThreads.title,
    })
    .from(executiveOperationalDecisions)
    .leftJoin(
      executiveOperationalThreads,
      eq(executiveOperationalDecisions.threadId, executiveOperationalThreads.id)
    )
    .where(and(...conditions))
    .orderBy(
      desc(executiveOperationalDecisions.priority),
      desc(executiveOperationalDecisions.updatedAt)
    )
    .limit(limit * 2);

  const all = rows.map((r) => rowToDecisionDto(r.decision, r.threadTitle));

  const pending = all.filter(
    (d) =>
      d.status === "open" ||
      (d.status === "deferred" &&
        d.deferredUntil &&
        new Date(d.deferredUntil).getTime() <= now.getTime())
  );
  const deferred = all.filter(
    (d) =>
      d.status === "deferred" &&
      d.deferredUntil &&
      new Date(d.deferredUntil).getTime() > now.getTime()
  );
  const recentlyDecided = all
    .filter((d) => d.status === "decided")
    .slice(0, 12);

  const urgentPending = pending.filter((d) => d.urgent);

  return {
    ok: true,
    pending: urgentPending.length ? urgentPending : pending,
    deferred,
    recentlyDecided,
    promotedCount,
    skipperDecisionContext: buildSkipperPendingDecisionsContext({ pending, deferred }),
    generatedAt: new Date().toISOString(),
  };
}

/** Per-thread open decision counts for sidebar badges. */
export async function countOpenDecisionsByThread(
  db: Db,
  input: { adminUserId: number; threadIds: string[] }
): Promise<Record<string, number>> {
  if (!input.threadIds.length) return {};
  const now = new Date();
  const rows = await db
    .select({
      threadId: executiveOperationalDecisions.threadId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(executiveOperationalDecisions)
    .where(
      and(
        eq(executiveOperationalDecisions.adminUserId, input.adminUserId),
        inArray(executiveOperationalDecisions.threadId, input.threadIds),
        or(
          eq(executiveOperationalDecisions.status, "open"),
          and(
            eq(executiveOperationalDecisions.status, "deferred"),
            or(
              isNull(executiveOperationalDecisions.deferredUntil),
              lte(executiveOperationalDecisions.deferredUntil, now)
            )
          )
        )
      )
    )
    .groupBy(executiveOperationalDecisions.threadId);

  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.threadId) out[r.threadId] = r.count;
  }
  return out;
}
