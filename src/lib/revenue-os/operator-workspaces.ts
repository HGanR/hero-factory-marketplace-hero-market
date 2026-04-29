/**
 * Discover workspace (client + trust) scopes for multi-workspace operator views.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyDistributionQueue, bentleyLeadHandoffs, bentleyLeadSignals } from "@/lib/db/schema";

export type OperatorWorkspaceKey = {
  clientId: string;
  trustId: string;
  label?: string;
};

function keyOf(w: OperatorWorkspaceKey): string {
  return `${w.clientId}\0${w.trustId}`;
}

export type DiscoverOperatorWorkspacesParams = {
  userId: string;
  /** When set, only include workspaces whose clientId is in this list. */
  clientIds?: string[] | null;
  /** When set, only include workspaces whose trustId is in this list. */
  trustIds?: string[] | null;
};

/**
 * Distinct (clientId, trustId) pairs from Bentley tables for this user.
 */
export async function discoverOperatorWorkspaces(
  params: DiscoverOperatorWorkspacesParams
): Promise<OperatorWorkspaceKey[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];

  const allowClient = params.clientIds?.length
    ? new Set(params.clientIds.map((c) => String(c).trim()))
    : null;
  const allowTrust = params.trustIds?.length
    ? new Set(params.trustIds.map((c) => String(c).trim()))
    : null;

  const merge = new Map<string, OperatorWorkspaceKey>();

  const consider = (clientId: string, trustId: string) => {
    const c = clientId ?? "";
    const t = trustId ?? "";
    if (allowClient && !allowClient.has(c)) return;
    if (allowTrust && !allowTrust.has(t)) return;
    const k = keyOf({ clientId: c, trustId: t });
    if (!merge.has(k)) merge.set(k, { clientId: c, trustId: t });
  };

  try {
    const db = await getDb();
    const qRows = await db
      .selectDistinct({
        clientId: bentleyDistributionQueue.clientId,
        trustId: bentleyDistributionQueue.trustId,
      })
      .from(bentleyDistributionQueue)
      .where(eq(bentleyDistributionQueue.userId, uid));
    for (const r of qRows) consider(r.clientId, r.trustId);

    const lsRows = await db
      .selectDistinct({
        clientId: bentleyLeadSignals.clientId,
        trustId: bentleyLeadSignals.trustId,
      })
      .from(bentleyLeadSignals)
      .where(eq(bentleyLeadSignals.userId, uid));
    for (const r of lsRows) consider(r.clientId, r.trustId);

    const lhRows = await db
      .selectDistinct({
        clientId: bentleyLeadHandoffs.clientId,
        trustId: bentleyLeadHandoffs.trustId,
      })
      .from(bentleyLeadHandoffs)
      .where(eq(bentleyLeadHandoffs.userId, uid));
    for (const r of lhRows) consider(r.clientId, r.trustId);
  } catch (e) {
    console.warn("[operator-workspaces] discover failed", e);
  }

  return [...merge.values()];
}
