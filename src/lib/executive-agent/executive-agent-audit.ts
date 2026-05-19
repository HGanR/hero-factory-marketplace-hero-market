import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentAuditLogs } from "@/lib/db/schema";

export type ExecutiveAuditApprovalStatus = "not_required" | "pending" | "approved" | "rejected" | "executed" | "failed";

export async function insertExecutiveAgentAuditLog(
  db: MySql2Database<typeof schema>,
  row: {
    id: string;
    adminUserId: number;
    prompt: string | null;
    toolName: string;
    actionType: string;
    targetType?: string | null;
    targetId?: string | null;
    inputJson?: string | null;
    outputJson?: string | null;
    approvalStatus?: ExecutiveAuditApprovalStatus;
  }
): Promise<void> {
  await db.insert(executiveAgentAuditLogs).values({
    id: row.id,
    adminUserId: row.adminUserId,
    prompt: row.prompt ?? null,
    toolName: row.toolName,
    actionType: row.actionType,
    targetType: row.targetType ?? null,
    targetId: row.targetId ?? null,
    inputJson: row.inputJson ?? null,
    outputJson: row.outputJson ?? null,
    approvalStatus: row.approvalStatus ?? "not_required",
  });
}
