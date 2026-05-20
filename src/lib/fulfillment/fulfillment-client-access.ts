import "server-only";

import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { clients } from "@/lib/db/schema";

type Db = MySql2Database<typeof schema>;

export async function assertClientOwnedByAdmin(
  db: Db,
  clientId: string,
  adminUserId: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [row] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, adminUserId)))
    .limit(1);
  if (!row) {
    return { ok: false, message: "Client not found or not owned by this admin user." };
  }
  return { ok: true };
}
