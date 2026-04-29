import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientServiceStatus } from "@/lib/db/schema";

export type PublicServiceState = "active" | "paused" | "delinquent" | "cancelled";

/**
 * If no row exists, service is considered active.
 */
export async function getClientPortalServiceDisplayForClientId(clientId: string): Promise<{
  status: string;
  showServiceBanner: boolean;
}> {
  const { status } = await getServiceStatusForClientId(clientId);
  const showServiceBanner = status === "paused" || status === "delinquent";
  return { status, showServiceBanner };
}

export async function getServiceStatusForClientId(clientId: string | null | undefined): Promise<{
  status: PublicServiceState;
  blocksWidget: boolean;
}> {
  if (!clientId?.trim()) {
    return { status: "active", blocksWidget: false };
  }
  await ensureClientPortalTables();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(clientServiceStatus)
    .where(eq(clientServiceStatus.clientId, clientId))
    .limit(1);
  if (!row) {
    return { status: "active", blocksWidget: false };
  }
  const s = (row.status ?? "active") as PublicServiceState;
  const blocksWidget = s === "paused" || s === "delinquent" || s === "cancelled";
  return { status: s, blocksWidget };
}
