/**
 * Client account ownership checks — no imports from `client-hub-queries` or `client-hub-rollup`
 * so rollup / intelligence can depend on this without circular graphs.
 */
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { clientAccounts } from "@/lib/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertValidClientId(id: string): void {
  if (!id || !UUID_RE.test(id.trim())) {
    throw new Error("Invalid client id");
  }
}

export async function getOwnedClientRow(userId: number, clientId: string) {
  assertValidClientId(clientId);
  const db = await getDb();
  const rows = await db
    .select()
    .from(clientAccounts)
    .where(and(eq(clientAccounts.id, clientId), eq(clientAccounts.ownerUserId, userId)))
    .limit(1);
  return rows[0] ?? null;
}
