import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { clientServiceOrderEvents } from "@/lib/db/schema";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";

type Db = MySql2Database<typeof schema>;

export async function insertFulfillmentOrderEvent(
  db: Db,
  row: {
    orderId: string;
    actorType: string;
    actorId?: string | null;
    fromStage?: string | null;
    toStage: string;
    payloadJson?: Record<string, unknown> | null;
  }
): Promise<string> {
  const id = randomUUID();
  await db.insert(clientServiceOrderEvents).values({
    id,
    orderId: row.orderId,
    actorType: row.actorType,
    actorId: row.actorId ?? null,
    fromStage: row.fromStage ?? null,
    toStage: row.toStage,
    payloadJson: row.payloadJson ? JSON.stringify(row.payloadJson).slice(0, 50_000) : null,
  });
  return id;
}

export async function auditFulfillmentExecutiveAction(
  db: Db,
  row: {
    adminUserId: number;
    toolName: string;
    actionType: string;
    targetType?: string | null;
    targetId?: string | null;
    inputJson?: Record<string, unknown> | null;
    outputJson?: Record<string, unknown> | null;
  }
): Promise<void> {
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId: row.adminUserId,
    prompt: null,
    toolName: row.toolName,
    actionType: row.actionType,
    targetType: row.targetType ?? null,
    targetId: row.targetId ?? null,
    inputJson: row.inputJson ? JSON.stringify(row.inputJson).slice(0, 50_000) : null,
    outputJson: row.outputJson ? JSON.stringify(row.outputJson).slice(0, 50_000) : null,
    approvalStatus: "not_required",
  });
}
