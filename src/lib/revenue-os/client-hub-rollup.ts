/**
 * Aggregated Client Hub metrics: Site → Agent → Widget → CRM → Campaigns.
 * Every query is scoped: `getOwnedClientRow` (from `client-hub-ownership`) must run first; helpers assume the client belongs to `userId`.
 */
import { and, count, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  aiAgentSiteBindings,
  aiAgents,
  campaignPosts,
  campaigns,
  crm_contacts,
  crm_conversations,
  crm_messages,
  web3Sites,
  widgetConversations,
  widgetMessages,
} from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import {
  countAutomationEventsForClient,
  maxAutomationEventCreatedAt,
} from "@/lib/revenue-os/client-hub-automation-sql";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import type { ClientAccountRow, ClientHubRollup } from "@/lib/revenue-os/client-hub-types";
import { syncClientHubRollupToSiteIntelligence } from "@/lib/site-builder/intelligence/client-hub-rollup-sync";

const LAUNCHED_STATUSES = ["LIVE", "COMPLETED"] as const;

export function isSiteIntelligenceSyncOnReadEnabled(): boolean {
  return process.env.SITE_INTELLIGENCE_SYNC_ON_READ === "true";
}

export function shouldSyncSiteIntelligenceOnRead(opts?: { skipIntelligenceWriteback?: boolean }): boolean {
  return !opts?.skipIntelligenceWriteback && isSiteIntelligenceSyncOnReadEnabled();
}

function toIso(d: Date | null | string | undefined): string | null {
  if (d == null) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
}

function isoMaxU(x: unknown): string | null {
  if (x == null) return null;
  if (x instanceof Date) return x.toISOString();
  if (typeof x === "string" || typeof x === "number") {
    const d = new Date(x);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function maxIso(...xs: (string | null | undefined)[]): string | null {
  const ok = xs.filter((x): x is string => Boolean(x));
  if (ok.length === 0) return null;
  return ok.reduce((a, b) => (a < b ? b : a), ok[0]!);
}

function n0(row: { n: number | unknown } | undefined): number {
  return Number(row?.n ?? 0);
}

/**
 * Metrics for an already-verified `client_accounts` row.
 */
export async function getClientHubRollupForOwnedClient(
  userId: number,
  clientId: string,
  account: ClientAccountRow,
  opts?: { skipIntelligenceWriteback?: boolean },
): Promise<ClientHubRollup> {
  await ensureClientHubTables();
  const db = await getDb();
  const [autoCounts, autoMaxAt] = await Promise.all([
    countAutomationEventsForClient(userId, clientId),
    maxAutomationEventCreatedAt(userId, clientId),
  ]);

  const siteIdRows = await db
    .select({ id: web3Sites.id })
    .from(web3Sites)
    .where(and(eq(web3Sites.userId, userId), eq(web3Sites.clientId, clientId)));
  const siteIds = siteIdRows.map((r) => r.id);

  const [
    leadsA,
    convA,
    openA,
    bookingsA,
    crmMsgA,
    campsA,
    activeSitesA,
    activeAgentsA,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(crm_contacts)
      .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId))),
    db
      .select({ n: count() })
      .from(crm_conversations)
      .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
      .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId))),
    db
      .select({ n: count() })
      .from(crm_conversations)
      .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
      .where(
        and(
          eq(crm_contacts.userId, userId),
          eq(crm_contacts.clientId, clientId),
          or(eq(crm_conversations.status, "open"), isNull(crm_conversations.status)),
        ),
      ),
    db
      .select({ n: count() })
      .from(crm_conversations)
      .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
      .where(
        and(
          eq(crm_contacts.userId, userId),
          eq(crm_contacts.clientId, clientId),
          or(sql`LOWER(${crm_conversations.channel}) = 'calendar'`, eq(crm_conversations.channel, "booking")),
        ),
      ),
    db
      .select({ n: count() })
      .from(crm_messages)
      .innerJoin(crm_conversations, eq(crm_messages.conversationId, crm_conversations.id))
      .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
      .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId))),
    db
      .select({ n: count() })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.userId, String(userId)),
          eq(campaigns.clientId, clientId),
          inArray(campaigns.status, LAUNCHED_STATUSES as unknown as string[]),
        ),
      ),
    db
      .select({ n: count() })
      .from(web3Sites)
      .where(
        and(
          eq(web3Sites.userId, userId),
          eq(web3Sites.clientId, clientId),
          inArray(web3Sites.status, ["DRAFT", "PUBLISHED"] as const),
        ),
      ),
    db
      .select({
        n: sql<number>`count(distinct ${aiAgentSiteBindings.agentId})`.mapWith(Number),
      })
      .from(aiAgentSiteBindings)
      .innerJoin(web3Sites, eq(web3Sites.id, aiAgentSiteBindings.siteId))
      .innerJoin(aiAgents, eq(aiAgents.id, aiAgentSiteBindings.agentId))
      .where(
        and(
          eq(web3Sites.userId, userId),
          eq(web3Sites.clientId, clientId),
          eq(aiAgentSiteBindings.isActive, true),
          eq(aiAgents.userId, userId),
        ),
      ),
  ]);

  const [msgMax, convMax, cMax, sMax, campMax, cpMax, wcMax] = await Promise.all([
    db
      .select({ m: sql<string | null>`max(${crm_messages.createdAt})`.as("m") })
      .from(crm_messages)
      .innerJoin(crm_conversations, eq(crm_messages.conversationId, crm_conversations.id))
      .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
      .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
      .then((r) => r[0]?.m ?? null),
    db
      .select({ m: sql<string | null>`max(${crm_conversations.lastMessageAt})`.as("m") })
      .from(crm_conversations)
      .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
      .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
      .then((r) => r[0]?.m ?? null),
    db
      .select({ m: sql<string | null>`max(${crm_contacts.updatedAt})`.as("m") })
      .from(crm_contacts)
      .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
      .then((r) => r[0]?.m ?? null),
    siteIds.length
      ? db
          .select({ m: sql<string | null>`max(${web3Sites.updatedAt})`.as("m") })
          .from(web3Sites)
          .where(
            and(
              eq(web3Sites.userId, userId),
              eq(web3Sites.clientId, clientId),
              ne(web3Sites.status, "ARCHIVED"),
            ),
          )
          .then((r) => r[0]?.m ?? null)
      : Promise.resolve(null as string | null),
    db
      .select({ m: sql<string | null>`max(${campaigns.updatedAt})`.as("m") })
      .from(campaigns)
      .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)))
      .then((r) => r[0]?.m ?? null),
    db
      .select({ m: sql<string | null>`max(${campaignPosts.postedAt})`.as("m") })
      .from(campaignPosts)
      .innerJoin(campaigns, eq(campaigns.id, campaignPosts.campaignId))
      .where(
        and(
          eq(campaigns.userId, String(userId)),
          eq(campaigns.clientId, clientId),
          eq(campaignPosts.status, "POSTED"),
        ),
      )
      .then((r) => r[0]?.m ?? null),
    siteIds.length
      ? db
          .select({ m: sql<string | null>`max(${widgetConversations.lastMessageAt})`.as("m") })
          .from(widgetConversations)
          .innerJoin(aiAgentSiteBindings, eq(widgetConversations.widgetBindingId, aiAgentSiteBindings.id))
          .where(
            and(inArray(aiAgentSiteBindings.siteId, siteIds), eq(widgetConversations.ownerUserId, userId)),
          )
          .then((r) => r[0]?.m ?? null)
      : Promise.resolve(null as string | null),
  ]);

  const campIdsRows = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)));
  const cids = campIdsRows.map((r) => r.id);
  const postedA =
    cids.length > 0
      ? await db
          .select({ n: count() })
          .from(campaignPosts)
          .where(and(inArray(campaignPosts.campaignId, cids), eq(campaignPosts.status, "POSTED")))
      : [{ n: 0 }];

  let widgetMsgN = 0;
  if (siteIds.length > 0) {
    const [wm] = await db
      .select({ n: count() })
      .from(widgetMessages)
      .innerJoin(widgetConversations, eq(widgetMessages.conversationId, widgetConversations.id))
      .innerJoin(aiAgentSiteBindings, eq(widgetConversations.widgetBindingId, aiAgentSiteBindings.id))
      .innerJoin(web3Sites, eq(web3Sites.id, aiAgentSiteBindings.siteId))
      .where(
        and(
          inArray(aiAgentSiteBindings.siteId, siteIds),
          eq(widgetConversations.ownerUserId, userId),
          eq(web3Sites.userId, userId),
          eq(web3Sites.clientId, clientId),
        ),
      );
    widgetMsgN = n0(wm);
  }

  const crmC = n0(leadsA[0]);
  const convC = n0(convA[0]);
  const crmMsg = n0(crmMsgA[0]);
  const postedN = n0(postedA[0]);

  const lastActivityAt = maxIso(
    toIso(account.updatedAt),
    isoMaxU(msgMax),
    isoMaxU(convMax),
    isoMaxU(cMax),
    isoMaxU(sMax),
    isoMaxU(campMax),
    isoMaxU(cpMax),
    isoMaxU(wcMax),
    autoMaxAt ? autoMaxAt.toISOString() : null,
  );

  const rollup = {
    leadsCaptured: crmC,
    conversationsOpened: convC,
    openConversations: n0(openA[0]),
    bookings: n0(bookingsA[0]),
    crmMessagesCount: crmMsg,
    widgetMessagesCount: widgetMsgN,
    messagesExchanged: crmMsg + widgetMsgN,
    agentInteractions: widgetMsgN,
    activeSites: n0(activeSitesA[0]),
    activeAgents: n0(activeAgentsA[0]),
    campaignsLaunched: n0(campsA[0]),
    publishedPosts: postedN,
    websiteVisits: null,
    lastActivityAt,
    leadQualifiedCount: autoCounts.leadQualifiedCount,
    followUpCount: autoCounts.followUpCount,
    taskCreatedCount: autoCounts.taskCreatedCount,
    bookingScheduledCount: autoCounts.bookingScheduledCount,
  } satisfies ClientHubRollup;

  if (shouldSyncSiteIntelligenceOnRead(opts)) {
    const startedAt = Date.now();
    try {
      const stat = await syncClientHubRollupToSiteIntelligence(db, userId, clientId, siteIds, rollup);
      console.info("[site-intelligence sync-on-read]", {
        userId,
        clientId,
        rowsMatched: stat.rowsMatched,
        rowsChanged: stat.rowsChanged,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.warn("[site-intelligence sync-on-read failed]", {
        userId,
        clientId,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return rollup;
}

export async function computeClientHubRollup(userId: number, clientId: string): Promise<ClientHubRollup | null> {
  const c = await getOwnedClientRow(userId, clientId);
  if (!c) return null;
  return getClientHubRollupForOwnedClient(userId, clientId, c as ClientAccountRow);
}
