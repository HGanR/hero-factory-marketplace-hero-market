import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { executiveOperationalDecisions, executiveOperationalThreads } from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import {
  rowToDecisionDto,
  promoteUnresolvedQuestionsForThread,
} from "@/lib/executive-agent/decision-queue-service";
import type {
  CreateExecutiveDecisionInput,
  ExecutiveOperationalDecisionDto,
} from "@/lib/executive-agent/executive-operational-decisions";
import { isExecutiveSubjectId, type ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import {
  postExecutiveOperationalThreadMessage,
  refreshThreadMemory,
  syncThreadDecisionNeededState,
} from "@/lib/executive-agent/operational-thread-service";

type Db = MySql2Database<typeof schema>;

async function auditDecisionAction(
  db: Db,
  row: {
    adminUserId: number;
    actionType: string;
    targetId: string;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown>;
  }
): Promise<void> {
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: row.adminUserId,
    prompt: null,
    toolName: "executive_operational_decisions",
    actionType: row.actionType,
    targetType: "executive_operational_decision",
    targetId: row.targetId,
    inputJson: row.inputJson ? JSON.stringify(row.inputJson).slice(0, 50_000) : null,
    outputJson: row.outputJson ? JSON.stringify(row.outputJson).slice(0, 50_000) : null,
    approvalStatus: "not_required",
  });
}

async function afterDecisionThreadSync(
  db: Db,
  input: { adminUserId: number; threadId: string | null }
): Promise<void> {
  if (!input.threadId) return;
  await refreshThreadMemory(db, input.threadId, input.adminUserId);
  await syncThreadDecisionNeededState(db, input.threadId, input.adminUserId);
}

export async function createExecutiveOperationalDecision(
  db: Db,
  input: { adminUserId: number } & CreateExecutiveDecisionInput
): Promise<{ ok: true; decision: ExecutiveOperationalDecisionDto }> {
  const id = randomUUID();
  const now = new Date();
  const subjectId =
    input.subjectId?.trim() && isExecutiveSubjectId(input.subjectId.trim())
      ? (input.subjectId.trim() as ExecutiveSubjectId)
      : null;

  let threadId = input.threadId?.trim() ?? null;
  if (threadId) {
    const [t] = await db
      .select({ id: executiveOperationalThreads.id })
      .from(executiveOperationalThreads)
      .where(
        and(
          eq(executiveOperationalThreads.id, threadId),
          eq(executiveOperationalThreads.adminUserId, input.adminUserId)
        )
      )
      .limit(1);
    if (!t) threadId = null;
  }

  if (input.supersedesDecisionId?.trim()) {
    await db
      .update(executiveOperationalDecisions)
      .set({
        status: "superseded",
        supersededByDecisionId: id,
        updatedAt: now,
      })
      .where(
        and(
          eq(executiveOperationalDecisions.id, input.supersedesDecisionId.trim()),
          eq(executiveOperationalDecisions.adminUserId, input.adminUserId)
        )
      );
    await auditDecisionAction(db, {
      adminUserId: input.adminUserId,
      actionType: "supersede_decision",
      targetId: input.supersedesDecisionId.trim(),
      inputJson: { supersededByDecisionId: id },
    });
  }

  await db.insert(executiveOperationalDecisions).values({
    id,
    adminUserId: input.adminUserId,
    title: input.title.trim().slice(0, 500),
    promptSummary: input.promptSummary.trim().slice(0, 4000),
    status: "open",
    priority: input.priority ?? "normal",
    sourceKind: input.sourceKind ?? "manual",
    threadId,
    questionMessageId: input.questionMessageId?.trim() ?? null,
    promotedFromMessageId: input.questionMessageId?.trim() ?? null,
    approvalId: input.approvalId?.trim() ?? null,
    orderId: input.orderId?.trim() ?? null,
    clientId: input.clientId?.trim() ?? null,
    subjectId,
    department: input.department ?? null,
    supersedesDecisionId: input.supersedesDecisionId?.trim() ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const [row] = await db
    .select()
    .from(executiveOperationalDecisions)
    .where(eq(executiveOperationalDecisions.id, id))
    .limit(1);

  await auditDecisionAction(db, {
    adminUserId: input.adminUserId,
    actionType: "create_decision",
    targetId: id,
    inputJson: { threadId, sourceKind: input.sourceKind },
  });

  if (threadId) {
    await afterDecisionThreadSync(db, { adminUserId: input.adminUserId, threadId });
  }

  return { ok: true, decision: rowToDecisionDto(row!) };
}

export async function recordExecutiveOperationalDecision(
  db: Db,
  input: { adminUserId: number; decisionId: string; decisionText: string }
): Promise<{ ok: true; decision: ExecutiveOperationalDecisionDto } | { ok: false; error: string }> {
  const [row] = await db
    .select()
    .from(executiveOperationalDecisions)
    .where(
      and(
        eq(executiveOperationalDecisions.id, input.decisionId),
        eq(executiveOperationalDecisions.adminUserId, input.adminUserId)
      )
    )
    .limit(1);

  if (!row) return { ok: false, error: "decision_not_found" };
  if (row.status !== "open" && row.status !== "deferred") {
    return { ok: false, error: "decision_not_actionable" };
  }

  const text = input.decisionText.trim();
  if (!text) return { ok: false, error: "empty_decision_text" };

  const now = new Date();
  await db
    .update(executiveOperationalDecisions)
    .set({
      status: "decided",
      decisionText: text.slice(0, 20_000),
      decidedAt: now,
      decidedByAdminUserId: input.adminUserId,
      deferredUntil: null,
      deferReason: null,
      updatedAt: now,
    })
    .where(eq(executiveOperationalDecisions.id, input.decisionId));

  await auditDecisionAction(db, {
    adminUserId: input.adminUserId,
    actionType: "decide",
    targetId: input.decisionId,
    inputJson: { decisionTextLength: text.length },
  });

  const threadId = row.threadId?.trim() ?? null;
  if (threadId) {
    await postExecutiveOperationalThreadMessage(db, {
      adminUserId: input.adminUserId,
      threadId,
      bodyText: `[Owner decision] ${text}`.slice(0, 20_000),
      messageKind: "status_update",
      ownerOnly: false,
    });
    await afterDecisionThreadSync(db, { adminUserId: input.adminUserId, threadId });
    await promoteUnresolvedQuestionsForThread(db, {
      adminUserId: input.adminUserId,
      threadId,
    });
    await syncThreadDecisionNeededState(db, threadId, input.adminUserId);
  }

  const [updated] = await db
    .select()
    .from(executiveOperationalDecisions)
    .where(eq(executiveOperationalDecisions.id, input.decisionId))
    .limit(1);

  return { ok: true, decision: rowToDecisionDto(updated!) };
}

export async function deferExecutiveOperationalDecision(
  db: Db,
  input: {
    adminUserId: number;
    decisionId: string;
    deferredUntil: string;
    deferReason?: string | null;
  }
): Promise<{ ok: true; decision: ExecutiveOperationalDecisionDto } | { ok: false; error: string }> {
  const [row] = await db
    .select()
    .from(executiveOperationalDecisions)
    .where(
      and(
        eq(executiveOperationalDecisions.id, input.decisionId),
        eq(executiveOperationalDecisions.adminUserId, input.adminUserId)
      )
    )
    .limit(1);

  if (!row) return { ok: false, error: "decision_not_found" };
  if (row.status !== "open") return { ok: false, error: "decision_not_open" };

  const until = new Date(input.deferredUntil);
  if (Number.isNaN(until.getTime())) return { ok: false, error: "invalid_deferred_until" };

  const now = new Date();
  await db
    .update(executiveOperationalDecisions)
    .set({
      status: "deferred",
      deferredUntil: until,
      deferReason: input.deferReason?.trim().slice(0, 2000) ?? null,
      updatedAt: now,
    })
    .where(eq(executiveOperationalDecisions.id, input.decisionId));

  await auditDecisionAction(db, {
    adminUserId: input.adminUserId,
    actionType: "defer_decision",
    targetId: input.decisionId,
    inputJson: { deferredUntil: until.toISOString(), deferReason: input.deferReason },
  });

  const threadId = row.threadId?.trim() ?? null;
  if (threadId) {
    await postExecutiveOperationalThreadMessage(db, {
      adminUserId: input.adminUserId,
      threadId,
      bodyText: `[Deferred until ${until.toISOString().slice(0, 10)}] ${input.deferReason?.trim() || "Owner deferred decision."}`,
      messageKind: "status_update",
    });
    await afterDecisionThreadSync(db, { adminUserId: input.adminUserId, threadId });
  }

  const [updated] = await db
    .select()
    .from(executiveOperationalDecisions)
    .where(eq(executiveOperationalDecisions.id, input.decisionId))
    .limit(1);

  return { ok: true, decision: rowToDecisionDto(updated!) };
}

/** Read-only bundle for Skipper — no autonomous deciding. */
export async function buildExecutivePendingDecisionsForSkipper(
  db: Db,
  input: {
    adminUserId: number;
    subjectId?: string | null;
    threadId?: string | null;
    orderId?: string | null;
    clientId?: string | null;
  }
) {
  const { listExecutivePendingDecisions } = await import(
    "@/lib/executive-agent/decision-queue-service"
  );
  const bundle = await listExecutivePendingDecisions(db, {
    adminUserId: input.adminUserId,
    subjectId: input.subjectId,
    threadId: input.threadId,
    orderId: input.orderId,
    promote: true,
  });

  return {
    recommendationOnly: true,
    humanOnlyDecisions: true,
    noAutonomousDeciding: true,
    headline: "Pending owner decisions — recommend options only; never decide or execute.",
    pending: bundle.pending.slice(0, 15),
    deferred: bundle.deferred.slice(0, 8),
    recentlyDecided: bundle.recentlyDecided.slice(0, 6),
    promotedCount: bundle.promotedCount,
    skipperDecisionContext: bundle.skipperDecisionContext,
    generatedAt: bundle.generatedAt,
  };
}
