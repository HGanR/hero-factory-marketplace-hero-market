import "server-only";

import { and, count, desc, eq, gte, max } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  clients,
  clientNotes,
  marketplaceUsers,
  web3Sites,
  campaigns,
  campaignPosts,
  socialEngagementThreads,
  oasisNpcMessages,
  oasisNpcSessions,
  oasisNpcs,
} from "@/lib/db/schema";
import { summarizeBentleyExecutiveBridge, summarizeBentleyLaunchReadinessForClient } from "@/lib/executive-agent/bentley-executive-bridge";
import { rollupSiteAnalyticsForExecutive } from "@/lib/analytics/site-analytics-store";

export type ExecutiveToolContext = {
  db: MySql2Database<typeof schema>;
  adminUserId: number;
  selectedClientId?: string | null;
  selectedCampaignId?: string | null;
};

export async function getPendingAccounts(ctx: ExecutiveToolContext) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [row] = await ctx.db
    .select({ n: count() })
    .from(marketplaceUsers)
    .where(and(eq(marketplaceUsers.isApproved, false), gte(marketplaceUsers.createdAt, since)));
  const [totalRow] = await ctx.db.select({ n: count() }).from(marketplaceUsers).where(eq(marketplaceUsers.isApproved, false));
  return {
    pendingApprox30d: Number(row?.n ?? 0),
    pendingAllTime: Number(totalRow?.n ?? 0),
    note: "Marketplace accounts where isApproved = false.",
  };
}

/**
 * Pending-client queue for Executive Agent / voice / chat orchestration.
 * Returns a public handoff summary only ({@link PendingClientsClaudeHandoffPublic}).
 * Full row DTOs: GET /api/admin/executive-agent/pending-clients.
 */
export async function getPendingClientsQueue(ctx: ExecutiveToolContext, limit = 50) {
  const { getPendingClientsQueueForExecutive } = await import("@/lib/executive-agent/pending-clients-queue");
  return getPendingClientsQueueForExecutive(ctx, limit);
}

import {
  fetchPendingMarketplaceUsersPreview,
  type PendingMarketplaceUsersPreviewOptions,
} from "@/lib/executive-agent/pending-marketplace-users-preview";

export async function getPendingMarketplaceUsersPreview(
  ctx: ExecutiveToolContext,
  limit = 30,
  options?: PendingMarketplaceUsersPreviewOptions,
) {
  return fetchPendingMarketplaceUsersPreview(ctx, limit, options ?? {});
}

export async function getApprovedAccounts(ctx: ExecutiveToolContext) {
  const [activeApproved] = await ctx.db
    .select({ n: count() })
    .from(marketplaceUsers)
    .where(and(eq(marketplaceUsers.isApproved, true), eq(marketplaceUsers.isActive, true)));
  const [approvedInactive] = await ctx.db
    .select({ n: count() })
    .from(marketplaceUsers)
    .where(and(eq(marketplaceUsers.isApproved, true), eq(marketplaceUsers.isActive, false)));
  return {
    approvedActive: Number(activeApproved?.n ?? 0),
    approvedInactive: Number(approvedInactive?.n ?? 0),
  };
}

export async function getActiveAccounts(ctx: ExecutiveToolContext) {
  const [row] = await ctx.db.select({ n: count() }).from(marketplaceUsers).where(eq(marketplaceUsers.isActive, true));
  return { activeUsers: Number(row?.n ?? 0) };
}

export async function getClientSummary(ctx: ExecutiveToolContext, clientId?: string | null) {
  const cid = (clientId ?? ctx.selectedClientId ?? "").trim();
  if (!cid) {
    return { error: "missing_client_id", message: "Select a client or pass clientId." };
  }
  const [c] = await ctx.db.select().from(clients).where(eq(clients.id, cid)).limit(1);
  if (!c) return { error: "not_found", clientId: cid };
  const [noteCount] = await ctx.db
    .select({ n: count() })
    .from(clientNotes)
    .where(eq(clientNotes.clientId, cid));
  return {
    clientId: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    email: c.email,
    status: c.status,
    city: c.city,
    state: c.state,
    internalNotes: Number(noteCount?.n ?? 0),
  };
}

export async function getClientTodos(ctx: ExecutiveToolContext, clientId?: string | null) {
  const cid = (clientId ?? ctx.selectedClientId ?? "").trim();
  if (!cid) return { items: [] as unknown[], message: "No client selected — returning empty list." };
  const notes = await ctx.db
    .select({
      id: clientNotes.id,
      createdAt: clientNotes.createdAt,
      note: clientNotes.note,
    })
    .from(clientNotes)
    .where(eq(clientNotes.clientId, cid))
    .orderBy(desc(clientNotes.createdAt))
    .limit(25);
  return {
    clientId: cid,
    items: notes.map((n) => ({
      id: n.id,
      kind: "internal_note",
      createdAt: n.createdAt,
      preview: (n.note ?? "").slice(0, 200),
    })),
  };
}

export async function getAgentConversationSummary(
  ctx: ExecutiveToolContext,
  opts?: { agentId?: string | null; clientId?: string | null }
) {
  const clientScope = (opts?.clientId ?? ctx.selectedClientId ?? "").trim() || null;
  const agentScope = opts?.agentId?.trim() || null;
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const npcRows = await ctx.db
      .select({
        id: oasisNpcs.id,
        name: oasisNpcs.name,
        npcId: oasisNpcs.npcId,
      })
      .from(oasisNpcs)
      .where(eq(oasisNpcs.isActive, true))
      .orderBy(desc(oasisNpcs.updatedAt))
      .limit(24);

    const npcs: Array<{
      name: string;
      npcId: string;
      sessions30d: number;
      messages30d: number;
      lastMessageAt: string | null;
    }> = [];

    for (const npc of npcRows) {
      const [sess] = await ctx.db
        .select({ n: count() })
        .from(oasisNpcSessions)
        .where(and(eq(oasisNpcSessions.npcId, npc.id), gte(oasisNpcSessions.lastActivity, since)));
      const [msgRow] = await ctx.db
        .select({ n: count() })
        .from(oasisNpcMessages)
        .innerJoin(oasisNpcSessions, eq(oasisNpcMessages.sessionId, oasisNpcSessions.id))
        .where(and(eq(oasisNpcSessions.npcId, npc.id), gte(oasisNpcMessages.createdAt, since)));
      const [lastRow] = await ctx.db
        .select({ m: max(oasisNpcMessages.createdAt) })
        .from(oasisNpcMessages)
        .innerJoin(oasisNpcSessions, eq(oasisNpcMessages.sessionId, oasisNpcSessions.id))
        .where(eq(oasisNpcSessions.npcId, npc.id));
      npcs.push({
        name: npc.name,
        npcId: npc.npcId,
        sessions30d: Number(sess?.n ?? 0),
        messages30d: Number(msgRow?.n ?? 0),
        lastMessageAt: lastRow?.m ? new Date(lastRow.m as unknown as string).toISOString() : null,
      });
    }

    return {
      source: "oasis_npc_sessions",
      clientScope,
      agentScope,
      windowDays: 30,
      npcs,
      note: "SKIPPER and executive read tools aggregate OASIS NPC sessions/messages — not full raw transcripts.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      source: "agent_conversation_sessions",
      clientScope,
      agentScope,
      error: msg,
      message: "NPC conversation rollup unavailable — check OASIS tables.",
    };
  }
}

export async function getBentleyCampaignOutputs(ctx: ExecutiveToolContext, opts?: { campaignId?: string | null }) {
  const campaignId = (opts?.campaignId ?? ctx.selectedCampaignId ?? "").trim();
  const clientId = (ctx.selectedClientId ?? "").trim();
  if (campaignId) {
    const [camp] = await ctx.db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!camp) return { error: "campaign_not_found", campaignId };
    const posts = await ctx.db
      .select({
        id: campaignPosts.id,
        platform: campaignPosts.platform,
        status: campaignPosts.status,
        scheduledAt: campaignPosts.scheduledAt,
      })
      .from(campaignPosts)
      .where(eq(campaignPosts.campaignId, campaignId))
      .limit(50);
    return {
      campaignId,
      name: camp.name,
      status: camp.status,
      hasBentleyPayload: Boolean(camp.bentleyGenerationJson),
      posts,
    };
  }
  if (!clientId) {
    return { message: "Provide selectedClientId or campaignId for Bentley outputs." };
  }
  const camps = await ctx.db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      bentleyGenerationJson: campaigns.bentleyGenerationJson,
    })
    .from(campaigns)
    .where(eq(campaigns.clientId, clientId))
    .orderBy(desc(campaigns.updatedAt))
    .limit(15);
  return {
    clientId,
    campaigns: camps.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      hasBentleyPayload: Boolean(c.bentleyGenerationJson),
    })),
  };
}

export async function getAiRevenueOsStatus(ctx: ExecutiveToolContext, clientId?: string | null) {
  const cid = (clientId ?? ctx.selectedClientId ?? "").trim();
  if (!cid) return { message: "No client id — cannot summarize Revenue OS campaigns." };
  const [nCamp] = await ctx.db.select({ n: count() }).from(campaigns).where(eq(campaigns.clientId, cid));
  const [scheduled] = await ctx.db
    .select({ n: count() })
    .from(campaignPosts)
    .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
    .where(and(eq(campaigns.clientId, cid), eq(campaignPosts.status, "SCHEDULED")));
  return {
    clientId: cid,
    campaignCount: Number(nCamp?.n ?? 0),
    scheduledPosts: Number(scheduled?.n ?? 0),
  };
}

export async function getSiteBuilderProjectStatus(ctx: ExecutiveToolContext, clientId?: string | null) {
  const cid = (clientId ?? ctx.selectedClientId ?? "").trim();
  if (!cid) return { sites: [] as unknown[], message: "No client id." };
  const sites = await ctx.db
    .select({
      id: web3Sites.id,
      name: web3Sites.name,
      status: web3Sites.status,
      updatedAt: web3Sites.updatedAt,
    })
    .from(web3Sites)
    .where(eq(web3Sites.clientId, cid))
    .orderBy(desc(web3Sites.updatedAt))
    .limit(20);
  return { clientId: cid, sites };
}

export async function getPlatformAnalyticsSummary(ctx: ExecutiveToolContext) {
  const [users] = await ctx.db.select({ n: count() }).from(marketplaceUsers);
  const [crm] = await ctx.db.select({ n: count() }).from(clients);
  const [camps] = await ctx.db.select({ n: count() }).from(campaigns);
  let siteTraffic: Awaited<ReturnType<typeof rollupSiteAnalyticsForExecutive>> = null;
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    siteTraffic = await rollupSiteAnalyticsForExecutive(ctx.db, { since, landingPath: "/" });
  } catch {
    siteTraffic = null;
  }
  return {
    marketplaceUsers: Number(users?.n ?? 0),
    crmClients: Number(crm?.n ?? 0),
    socialCampaigns: Number(camps?.n ?? 0),
    generatedAt: new Date().toISOString(),
    siteTraffic,
  };
}

export async function getInboxEngagementSummary(ctx: ExecutiveToolContext) {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [threads] = await ctx.db
      .select({ n: count() })
      .from(socialEngagementThreads)
      .where(gte(socialEngagementThreads.updatedAt, since));
    return { threadsLast7d: Number(threads?.n ?? 0) };
  } catch {
    return { unavailable: true, message: "Engagement tables not available." };
  }
}

export async function getBentleyExecutiveBridgeSummary(ctx: ExecutiveToolContext) {
  const platform = await summarizeBentleyExecutiveBridge(ctx.db, ctx);
  const cid = (ctx.selectedClientId ?? "").trim();
  const clientScoped =
    cid.length > 0 ? await summarizeBentleyLaunchReadinessForClient(ctx.db, cid) : null;
  return {
    platform,
    clientScoped,
    generatedAt: new Date().toISOString(),
  };
}

export async function getKnowledgeBaseSummary(_ctx: ExecutiveToolContext) {
  return {
    collections: [] as string[],
    message: "Knowledge base integration is not wired — placeholder summary only.",
  };
}
