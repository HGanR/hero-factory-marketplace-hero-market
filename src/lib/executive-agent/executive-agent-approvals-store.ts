import "server-only";

import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentApprovals } from "@/lib/db/schema";

export type ExecutiveApprovalStatus = "pending" | "approved" | "rejected" | "executed" | "failed";

export async function insertExecutiveApproval(
  db: MySql2Database<typeof schema>,
  row: {
    id: string;
    adminUserId: number;
    proposedAction: string;
    targetType?: string | null;
    targetId?: string | null;
    payloadJson: string;
  }
): Promise<void> {
  await db.insert(executiveAgentApprovals).values({
    id: row.id,
    adminUserId: row.adminUserId,
    proposedAction: row.proposedAction,
    targetType: row.targetType ?? null,
    targetId: row.targetId ?? null,
    payloadJson: row.payloadJson,
    status: "pending",
  });
}

export async function listExecutiveApprovals(
  db: MySql2Database<typeof schema>,
  opts: { adminUserId: number; status?: ExecutiveApprovalStatus; limit?: number }
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const filters = [eq(executiveAgentApprovals.adminUserId, opts.adminUserId)];
  if (opts.status != null) {
    filters.push(eq(executiveAgentApprovals.status, opts.status));
  }
  return db
    .select()
    .from(executiveAgentApprovals)
    .where(and(...filters))
    .orderBy(desc(executiveAgentApprovals.createdAt))
    .limit(limit);
}

export async function getExecutiveApprovalById(
  db: MySql2Database<typeof schema>,
  id: string,
  adminUserId: number
) {
  const [row] = await db
    .select()
    .from(executiveAgentApprovals)
    .where(and(eq(executiveAgentApprovals.id, id), eq(executiveAgentApprovals.adminUserId, adminUserId)))
    .limit(1);
  return row ?? null;
}

export async function setExecutiveApprovalStatus(
  db: MySql2Database<typeof schema>,
  id: string,
  adminUserId: number,
  status: ExecutiveApprovalStatus,
  opts?: { executedAt?: Date | null }
): Promise<void> {
  const executedAt =
    opts?.executedAt !== undefined
      ? opts.executedAt
      : status === "executed" || status === "failed"
        ? new Date()
        : undefined;
  await db
    .update(executiveAgentApprovals)
    .set({
      status,
      ...(executedAt ? { executedAt } : {}),
    })
    .where(and(eq(executiveAgentApprovals.id, id), eq(executiveAgentApprovals.adminUserId, adminUserId)));
}

/** Internal admin gate only. Never serialize a foreign row in responses or audits. */
export async function getExecutiveApprovalForGate(
  db: MySql2Database<typeof schema>, id: string
) {
  const [row] = await db.select().from(executiveAgentApprovals)
    .where(eq(executiveAgentApprovals.id, id)).limit(1);
  return row ?? null;
}

/** Reserve pending only after ownership and explicit confirmation pass. */
export async function claimPendingExecutiveApproval(
  db: MySql2Database<typeof schema>, id: string, adminUserId: number
): Promise<boolean> {
  const [result] = await db.update(executiveAgentApprovals).set({ status: "approved" })
    .where(and(
      eq(executiveAgentApprovals.id, id),
      eq(executiveAgentApprovals.adminUserId, adminUserId),
      eq(executiveAgentApprovals.status, "pending")
    ));
  return result.affectedRows === 1;
}

/** Must run in the execution transaction; serializes competing dispatch attempts. */
export async function lockExecutiveApprovalForExecution(
  db: MySql2Database<typeof schema>, id: string, adminUserId: number
) {
  const [row] = await db.select().from(executiveAgentApprovals)
    .where(and(eq(executiveAgentApprovals.id, id), eq(executiveAgentApprovals.adminUserId, adminUserId)))
    .limit(1).for("update");
  return row ?? null;
}

