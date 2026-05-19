import "server-only";

import { and, count, desc, eq, gte, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  campaignPosts,
  campaigns,
  clientNotes,
  clients,
  executiveAgentApprovals,
  marketplaceUsers,
  socialEngagementThreads,
} from "@/lib/db/schema";
import type { ExecutiveToolContext } from "@/lib/executive-agent/executive-agent-tools";
import type { ClientFollowUpSignals } from "@/lib/executive-agent/client-followup-recommendations";

export type { ClientFollowUpSignals, FollowUpRecommendation } from "@/lib/executive-agent/client-followup-recommendations";
export { buildFollowUpRecommendations } from "@/lib/executive-agent/client-followup-recommendations";

const STALE_MS = 30 * 24 * 60 * 60 * 1000;

export async function gatherClientFollowUpSignals(
  db: MySql2Database<typeof schema>,
  ctx: ExecutiveToolContext,
): Promise<ClientFollowUpSignals> {
  const since = new Date(Date.now() - STALE_MS);
  let pendingAccountsApprox30d: number | null = null;
  let approvedInactiveAccounts: number | null = null;
  let clientsStaleCount: number | null = null;
  let campaignsWithOutputsNoScheduledPost: number | null = null;
  let pendingExecutiveApprovals: number | null = null;
  let clientsWithEngagementNoAdminNote7d: number | null = null;
  const recentNoteActivitySample: string[] = [];

  try {
    const [p] = await db
      .select({ n: count() })
      .from(marketplaceUsers)
      .where(and(eq(marketplaceUsers.isApproved, false), gte(marketplaceUsers.createdAt, since)));
    pendingAccountsApprox30d = Number(p?.n ?? 0);
  } catch {
    pendingAccountsApprox30d = null;
  }

  try {
    const [i] = await db
      .select({ n: count() })
      .from(marketplaceUsers)
      .where(and(eq(marketplaceUsers.isApproved, true), eq(marketplaceUsers.isActive, false)));
    approvedInactiveAccounts = Number(i?.n ?? 0);
  } catch {
    approvedInactiveAccounts = null;
  }

  try {
    const staleSub = db
      .select({ clientId: clientNotes.clientId })
      .from(clientNotes)
      .where(gte(clientNotes.createdAt, since))
      .groupBy(clientNotes.clientId)
      .as("recent_notes");

    const [c] = await db
      .select({ n: count() })
      .from(clients)
      .leftJoin(staleSub, eq(clients.id, staleSub.clientId))
      .where(and(eq(clients.status, "active"), isNull(staleSub.clientId)));
    clientsStaleCount = Number(c?.n ?? 0);
  } catch {
    clientsStaleCount = null;
  }

  try {
    const [camp] = await db
      .select({ n: count() })
      .from(campaignPosts)
      .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
      .where(
        and(
          isNull(campaignPosts.scheduledAt),
          or(eq(campaignPosts.status, "DRAFT"), eq(campaignPosts.status, "FAILED")),
          sql`${campaigns.bentleyGenerationJson} IS NOT NULL`,
        ),
      );
    campaignsWithOutputsNoScheduledPost = Number(camp?.n ?? 0);
  } catch {
    campaignsWithOutputsNoScheduledPost = null;
  }

  try {
    const [ap] = await db
      .select({ n: count() })
      .from(executiveAgentApprovals)
      .where(and(eq(executiveAgentApprovals.adminUserId, ctx.adminUserId), eq(executiveAgentApprovals.status, "pending")));
    pendingExecutiveApprovals = Number(ap?.n ?? 0);
  } catch {
    pendingExecutiveApprovals = null;
  }

  try {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const threadClients = await db
      .selectDistinct({ clientId: socialEngagementThreads.clientId })
      .from(socialEngagementThreads)
      .where(
        and(
          ne(socialEngagementThreads.clientId, ""),
          isNotNull(socialEngagementThreads.lastMessageAt),
          gte(socialEngagementThreads.lastMessageAt, since7d),
        ),
      );
    const notedClients = await db
      .selectDistinct({ clientId: clientNotes.clientId })
      .from(clientNotes)
      .where(gte(clientNotes.createdAt, since7d));
    const noted = new Set(notedClients.map((r) => r.clientId).filter(Boolean));
    let n = 0;
    for (const t of threadClients) {
      if (t.clientId && !noted.has(t.clientId)) n += 1;
    }
    clientsWithEngagementNoAdminNote7d = n;
  } catch {
    clientsWithEngagementNoAdminNote7d = null;
  }

  try {
    const rows = await db
      .select({ createdAt: clientNotes.createdAt })
      .from(clientNotes)
      .orderBy(desc(clientNotes.createdAt))
      .limit(5);
    for (const r of rows) {
      if (r.createdAt) recentNoteActivitySample.push(r.createdAt.toISOString());
    }
  } catch {
    /* */
  }

  return {
    pendingAccountsApprox30d,
    approvedInactiveAccounts,
    clientsStaleCount,
    campaignsWithOutputsNoScheduledPost,
    pendingExecutiveApprovals,
    clientsWithEngagementNoAdminNote7d,
    recentNoteActivitySample,
  };
}

/**
 * Sample active CRM clients with no internal notes in the stale window (same rule as clientsStaleCount).
 * Used by executive scheduled routines to queue createTodo approvals — capped by caller.
 */
export async function listStaleActiveClientIdsForExecutiveRoutine(
  db: MySql2Database<typeof schema>,
  limit = 8
): Promise<string[]> {
  const since = new Date(Date.now() - STALE_MS);
  const cap = Math.min(Math.max(limit, 1), 50);
  try {
    const staleSub = db
      .select({ clientId: clientNotes.clientId })
      .from(clientNotes)
      .where(gte(clientNotes.createdAt, since))
      .groupBy(clientNotes.clientId)
      .as("recent_notes");

    const rows = await db
      .select({ id: clients.id })
      .from(clients)
      .leftJoin(staleSub, eq(clients.id, staleSub.clientId))
      .where(and(eq(clients.status, "active"), isNull(staleSub.clientId)))
      .limit(cap);
    return rows.map((r) => r.id);
  } catch {
    return [];
  }
}
