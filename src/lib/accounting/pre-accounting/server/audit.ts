import "server-only";

import { getDb } from "@/lib/db";
import { accountingAuditLog } from "@/lib/db/schema.pre-accounting";

export type InsertAccountingAuditLogInput = {
  accountingProfileId?: number | null;
  actorId?: number | null;
  actionType: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
};

export async function insertAccountingAuditLog(input: InsertAccountingAuditLogInput): Promise<void> {
  const db = await getDb();
  await db.insert(accountingAuditLog).values({
    accountingProfileId: input.accountingProfileId ?? null,
    actorId: input.actorId ?? null,
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    metadataJson: input.metadata != null ? JSON.stringify(input.metadata) : null,
  });
}
