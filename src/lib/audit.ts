import crypto from "crypto";
import { auditLogs } from "@/lib/db/schema";

type AuditInsertable = {
  actorUserId: number | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
};

/**
 * Insert an audit log row. This is intentionally lightweight so API routes can call it
 * inside an existing Drizzle transaction (pass tx) or with a normal db handle.
 */
export async function insertAuditLog(
  dbOrTx: { insert: Function },
  entry: AuditInsertable
): Promise<void> {
  const metadataJson =
    entry.metadata === undefined ? null : entry.metadata === null ? null : JSON.stringify(entry.metadata);

  await dbOrTx.insert(auditLogs).values({
    id: crypto.randomUUID(),
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadataJson,
  } as any);
}



