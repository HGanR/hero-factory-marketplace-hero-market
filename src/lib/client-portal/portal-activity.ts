import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientPortalActivityLog } from "@/lib/db/schema";

export async function logClientPortalActivity(
  clientId: string,
  portalUserId: string | null,
  action: string,
  payload?: Record<string, unknown> | null,
) {
  await ensureClientPortalTables();
  const db = await getDb();
  await db.insert(clientPortalActivityLog).values({
    id: randomUUID(),
    clientId,
    portalUserId: portalUserId ?? null,
    action,
    payloadJson: payload ?? null,
  });
}
