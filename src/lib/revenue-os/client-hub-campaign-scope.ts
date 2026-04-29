import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-queries";

export type ClientScopedCampaign = {
  id: string;
  userId: string;
  clientId: string;
  name: string;
  status: string;
};

/**
 * Verifies the URL `clientId` is owned, then that the campaign belongs to the same user
 * and is attributed to that client (not another client or blank if you require match).
 */
export async function getCampaignForOwnedClient(
  userId: number,
  clientId: string,
  campaignId: string,
  requireClientMatch: boolean,
): Promise<ClientScopedCampaign | null> {
  if (!(await getOwnedClientRow(userId, clientId))) return null;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, String(userId))))
    .limit(1);
  if (!row) return null;
  if (requireClientMatch && (row.clientId ?? "").trim() !== clientId.trim()) {
    return null;
  }
  return {
    id: row.id,
    userId: row.userId,
    clientId: row.clientId ?? "",
    name: row.name,
    status: row.status,
  };
}
