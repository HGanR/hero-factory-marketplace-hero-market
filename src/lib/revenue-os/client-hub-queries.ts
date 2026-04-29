/**
 * User-scoped client hub queries. Every function takes `userId` and never trusts `clientId` without
 * `client_accounts.ownerUserId = userId`.
 */
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  aiAgentSiteBindings,
  aiAgents,
  clientAccounts,
  campaigns,
  crm_contacts,
  crm_conversations,
  web3Sites,
  web3SiteVersions,
} from "@/lib/db/schema";
import { getClientActivityTimeline } from "@/lib/revenue-os/client-activity-timeline-adapter";
import {
  computeClientHealthScoreFromRollup,
  countAnyCampaignsByClientIds,
  countAutomationEventsLastDays,
  countBookingsByClientIds,
  countConversationsByClientIds,
  countLaunchedCampaignsByClientIds,
  countLeadsMissingFollowUp,
  countLeadsMissingFollowUpByClientIds,
  countPostedPostsByClientIds,
  countTotalCampaignsForClient,
  getNextBestClientActionFromContext,
} from "@/lib/revenue-os/client-hub-intelligence";
import { loadAutomationBatchForClients } from "@/lib/revenue-os/client-hub-automation-sql";
import {
  assertValidClientId,
  getOwnedClientRow,
} from "@/lib/revenue-os/client-hub-ownership";
import { getClientHubRollupForOwnedClient } from "@/lib/revenue-os/client-hub-rollup";
import type {
  ClientActivityItem,
  ClientAgentRow,
  ClientAnalyticsResponse,
  ClientAccountRow,
  ClientHubRollup,
  ClientListItem,
  ClientSiteRow,
  ClientSummary,
  InboxRow,
} from "@/lib/revenue-os/client-hub-types";

export { assertValidClientId, getOwnedClientRow };
export { computeClientHealthScore, getNextBestClientAction } from "@/lib/revenue-os/client-hub-intelligence";

/**
 * Resolves which `client_accounts.id` to attribute for a site↔agent widget bind.
 * - If `clientId` is present in the body (string): must be a UUID owned by `userId` (or null/"" to clear binding attribution only when explicitly sent — see bodyHasClientKey).
 * - If the key is omitted: inherit from `siteClientId` when the site row already points at an owned client.
 * Never returns an id the user does not own.
 */
export async function resolveClientIdForWidgetBinding(
  userId: number,
  siteClientId: string | null | undefined,
  body: Record<string, unknown>,
): Promise<string | null> {
  const hasKey = Object.prototype.hasOwnProperty.call(body, "clientId");
  if (hasKey) {
    const raw = body.clientId;
    if (raw === null || raw === undefined) {
      return null;
    }
    if (typeof raw !== "string") {
      throw new Error("clientId must be a string or null");
    }
    const t = raw.trim();
    if (!t) {
      return null;
    }
    const row = await getOwnedClientRow(userId, t);
    if (!row) {
      throw new Error("Client not found or access denied");
    }
    return row.id;
  }
  const fromSite = siteClientId?.trim() || "";
  if (!fromSite) {
    return null;
  }
  try {
    assertValidClientId(fromSite);
  } catch {
    return null;
  }
  const row = await getOwnedClientRow(userId, fromSite);
  return row?.id ?? null;
}

export type CreateClientInput = {
  name: string;
  status?: string;
  workspaceId?: string | null;
  notes?: string | null;
  logoUrl?: string | null;
  requestedServices?: string[] | null;
};

export async function createClientAccount(userId: number, input: CreateClientInput) {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("name required");
  const id = randomUUID();
  const db = await getDb();
  await db.insert(clientAccounts).values({
    id,
    ownerUserId: userId,
    name,
    status: (input.status ?? "active").trim() || "active",
    workspaceId: input.workspaceId ?? null,
    notes: input.notes ?? null,
    logoUrl: input.logoUrl ?? null,
    servicesJson: Array.isArray(input.requestedServices) ? JSON.stringify(input.requestedServices) : null,
  });
  return { id } as const;
}

export type UpdateClientInput = {
  name?: string;
  status?: string;
  workspaceId?: string | null;
  notes?: string | null;
  logoUrl?: string | null;
  requestedServices?: string[] | null;
};

export async function updateClientAccount(userId: number, clientId: string, patch: UpdateClientInput) {
  const client = await getOwnedClientRow(userId, clientId);
  if (!client) return null;
  const db = await getDb();
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = String(patch.name).trim();
    if (!n) throw new Error("name cannot be empty");
    set.name = n;
  }
  if (patch.status !== undefined) set.status = String(patch.status).trim() || client.status;
  if (patch.workspaceId !== undefined) set.workspaceId = patch.workspaceId;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.logoUrl !== undefined) set.logoUrl = patch.logoUrl;
  if (patch.requestedServices !== undefined) {
    set.servicesJson = Array.isArray(patch.requestedServices) ? JSON.stringify(patch.requestedServices) : null;
  }
  if (Object.keys(set).length === 0) return getOwnedClientRow(userId, clientId);
  await db
    .update(clientAccounts)
    .set(
      set as {
        name?: string;
        status?: string;
        workspaceId?: string | null;
        notes?: string | null;
        logoUrl?: string | null;
        servicesJson?: string | null;
      },
    )
    .where(and(eq(clientAccounts.id, clientId), eq(clientAccounts.ownerUserId, userId)));
  return getOwnedClientRow(userId, clientId);
}

function readCustomFieldStrings(customFields: unknown, keys: string[]): string | null {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) return null;
  const o = customFields as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function parseRequestedServices(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function listClientsForUser(userId: number): Promise<ClientListItem[]> {
  const db = await getDb();
  const clients = await db
    .select()
    .from(clientAccounts)
    .where(eq(clientAccounts.ownerUserId, userId))
    .orderBy(desc(clientAccounts.updatedAt));

  if (clients.length === 0) return [];

  const ids = clients.map((c) => c.id);

  const [siteAgg, contactAgg, convOpen] = await Promise.all([
    db
      .select({ clientId: web3Sites.clientId, n: count() })
      .from(web3Sites)
      .where(
        and(eq(web3Sites.userId, userId), isNotNull(web3Sites.clientId), inArray(web3Sites.clientId, ids as string[])),
      )
      .groupBy(web3Sites.clientId),
    db
      .select({ clientId: crm_contacts.clientId, n: count() })
      .from(crm_contacts)
      .where(
        and(
          eq(crm_contacts.userId, userId),
          isNotNull(crm_contacts.clientId),
          inArray(crm_contacts.clientId, ids as string[]),
        ),
      )
      .groupBy(crm_contacts.clientId),
    db
      .select({ clientId: crm_contacts.clientId, n: count() })
      .from(crm_conversations)
      .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
      .where(
        and(
          eq(crm_contacts.userId, userId),
          isNotNull(crm_contacts.clientId),
          inArray(crm_contacts.clientId, ids as string[]),
          or(eq(crm_conversations.status, "open"), isNull(crm_conversations.status)),
        ),
      )
      .groupBy(crm_contacts.clientId),
  ]);

  const siteMap = new Map((siteAgg as { clientId: string | null; n: number }[]).map((r) => [r.clientId, r.n]));
  const leadMap = new Map(
    (contactAgg as { clientId: string | null; n: number }[]).map((r) => [r.clientId, r.n]),
  );
  const openMap = new Map(
    (convOpen as { clientId: string | null; n: number }[]).map((r) => [r.clientId, r.n]),
  );

  const bindingRows = await db
    .select({
      clientId: web3Sites.clientId,
      n: sql<number>`count(distinct ${aiAgentSiteBindings.id})`.mapWith(Number),
    })
    .from(aiAgentSiteBindings)
    .innerJoin(web3Sites, eq(aiAgentSiteBindings.siteId, web3Sites.id))
    .where(
      and(
        eq(web3Sites.userId, userId),
        isNotNull(web3Sites.clientId),
        inArray(web3Sites.clientId, ids as string[]),
        eq(aiAgentSiteBindings.isActive, true),
      ),
    )
    .groupBy(web3Sites.clientId);
  const bindMap = new Map(
    (bindingRows as { clientId: string | null; n: number }[]).map((r) => [r.clientId, r.n]),
  );

  const [
    autoBatch,
    convMap,
    campAnyMap,
    campLaunchMap,
    postedMap,
    bookMap,
    followMissingMap,
  ] = await Promise.all([
    loadAutomationBatchForClients(userId, ids),
    countConversationsByClientIds(userId, ids),
    countAnyCampaignsByClientIds(userId, ids),
    countLaunchedCampaignsByClientIds(userId, ids),
    countPostedPostsByClientIds(userId, ids),
    countBookingsByClientIds(userId, ids),
    countLeadsMissingFollowUpByClientIds(userId, ids),
  ]);

  return clients.map((c) => {
    const lastActivityAt = c.updatedAt ? new Date(c.updatedAt).toISOString() : null;
    const auto = autoBatch.get(c.id);
    const sitesN = siteMap.get(c.id) ?? 0;
    const bindsN = bindMap.get(c.id) ?? 0;
    const leadsN = leadMap.get(c.id) ?? 0;
    const openN = openMap.get(c.id) ?? 0;
    const convN = convMap.get(c.id) ?? 0;
    const campAny = campAnyMap.get(c.id) ?? 0;
    const campLaunched = campLaunchMap.get(c.id) ?? 0;
    const postedN = postedMap.get(c.id) ?? 0;
    const bookN = bookMap.get(c.id) ?? 0;
    const counts = auto?.counts ?? {
      leadQualifiedCount: 0,
      followUpCount: 0,
      taskCreatedCount: 0,
      bookingScheduledCount: 0,
    };
    const rollLike = {
      leadsCaptured: leadsN,
      conversationsOpened: convN,
      openConversations: openN,
      bookings: bookN,
      crmMessagesCount: 0,
      widgetMessagesCount: 0,
      messagesExchanged: 0,
      agentInteractions: 0,
      activeSites: sitesN,
      activeAgents: bindsN > 0 ? 1 : 0,
      campaignsLaunched: campLaunched,
      publishedPosts: postedN,
      websiteVisits: null,
      lastActivityAt,
      leadQualifiedCount: counts.leadQualifiedCount,
      followUpCount: counts.followUpCount,
      taskCreatedCount: counts.taskCreatedCount,
      bookingScheduledCount: counts.bookingScheduledCount,
    } satisfies ClientHubRollup;
    const health = computeClientHealthScoreFromRollup(rollLike, {
      leadsMissingFollowUp: followMissingMap.get(c.id) ?? 0,
      campaignsAnyTotal: campAny,
      automationEventsLast7Days: auto?.eventsLast7Days ?? 0,
    });
    const campaignStatus =
      campLaunched > 0 ? ("active" as const) : campAny > 0 ? ("unknown" as const) : ("none" as const);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      workspaceId: c.workspaceId ?? null,
      logoUrl: typeof c.logoUrl === "string" && c.logoUrl.trim() ? c.logoUrl : null,
      requestedServices: parseRequestedServices(c.servicesJson),
      siteCount: sitesN,
      agentBindingCount: bindsN,
      openConversations: openN,
      leadsCount: leadsN,
      campaignStatus,
      lastActivityAt,
      updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
      healthScore: health.score,
      healthLabel: health.label,
      healthStatus: health.status,
    } satisfies ClientListItem;
  });
}

export function extractWidgetKeyFromSchemaJson(schemaText: string | null | undefined): string | null {
  if (!schemaText) return null;
  try {
    const j = JSON.parse(schemaText) as { metadata?: { widgetIntegration?: { widgetKey?: string } } };
    const k = j?.metadata?.widgetIntegration?.widgetKey;
    return typeof k === "string" && k.trim() ? k.trim().slice(0, 200) : null;
  } catch {
    return null;
  }
}

async function getLatestVersionSchemaForSite(
  siteId: string,
): Promise<string | null> {
  const db = await getDb();
  const rows = await db
    .select({ schemaJson: web3SiteVersions.schemaJson })
    .from(web3SiteVersions)
    .where(eq(web3SiteVersions.siteId, siteId))
    .orderBy(desc(web3SiteVersions.version))
    .limit(1);
  return rows[0]?.schemaJson ?? null;
}

export async function listSitesForClient(userId: number, clientId: string): Promise<ClientSiteRow[]> {
  const client = await getOwnedClientRow(userId, clientId);
  if (!client) return [];

  const db = await getDb();
  const sites = await db
    .select()
    .from(web3Sites)
    .where(and(eq(web3Sites.userId, userId), eq(web3Sites.clientId, clientId)))
    .orderBy(desc(web3Sites.updatedAt));

  const out: ClientSiteRow[] = [];
  for (const s of sites) {
    const schemaJson = await getLatestVersionSchemaForSite(s.id);
    const widgetKey = extractWidgetKeyFromSchemaJson(schemaJson);
    const [bind] = await db
      .select({ agentId: aiAgentSiteBindings.agentId, widgetKey: aiAgentSiteBindings.widgetKey })
      .from(aiAgentSiteBindings)
      .where(and(eq(aiAgentSiteBindings.siteId, s.id), eq(aiAgentSiteBindings.isActive, true)))
      .limit(1);
    let boundAgentName: string | null = null;
    if (bind?.agentId) {
      const [ag] = await db.select().from(aiAgents).where(eq(aiAgents.id, bind.agentId)).limit(1);
      boundAgentName = ag?.name ?? null;
    }
    out.push({
      id: s.id,
      name: s.name,
      status: s.status,
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : "",
      hasWidget: Boolean(widgetKey || bind?.widgetKey),
      widgetKey: widgetKey || bind?.widgetKey || null,
      boundAgentId: bind?.agentId ?? null,
      boundAgentName,
    });
  }
  return out;
}

export async function listAgentBindingsForClient(
  userId: number,
  clientId: string,
): Promise<ClientAgentRow[]> {
  const client = await getOwnedClientRow(userId, clientId);
  if (!client) return [];
  const db = await getDb();
  const sites = await db
    .select({ id: web3Sites.id, name: web3Sites.name })
    .from(web3Sites)
    .where(and(eq(web3Sites.userId, userId), eq(web3Sites.clientId, clientId)));
  if (sites.length === 0) {
    // Fallback: bindings with clientId column set
    const binds = await db
      .select()
      .from(aiAgentSiteBindings)
      .where(and(eq(aiAgentSiteBindings.clientId, clientId), eq(aiAgentSiteBindings.isActive, true)));
    const out: ClientAgentRow[] = [];
    for (const b of binds) {
      const [st] = await db.select().from(web3Sites).where(eq(web3Sites.id, b.siteId)).limit(1);
      if (!st || st.userId !== userId) continue;
      const [ag] = await db.select().from(aiAgents).where(eq(aiAgents.id, b.agentId)).limit(1);
      if (!ag || ag.userId !== userId) continue;
      const tools = Boolean(ag.toolsJson && String(ag.toolsJson).length > 2);
      out.push({
        bindingId: b.id,
        agentId: b.agentId,
        agentName: ag.name,
        agentStatus: ag.status,
        siteId: b.siteId,
        siteName: st.name,
        widgetKey: b.widgetKey,
        hasKnowledge: true,
        toolsEnabled: tools,
      });
    }
    return out;
  }
  const siteIds = sites.map((s) => s.id);
  const binds = await db
    .select()
    .from(aiAgentSiteBindings)
    .where(and(inArray(aiAgentSiteBindings.siteId, siteIds), eq(aiAgentSiteBindings.isActive, true)));
  const nameBySite = new Map(sites.map((s) => [s.id, s.name]));
  const out: ClientAgentRow[] = [];
  for (const b of binds) {
    const [ag] = await db.select().from(aiAgents).where(eq(aiAgents.id, b.agentId)).limit(1);
    if (!ag || ag.userId !== userId) continue;
    const tools = Boolean(ag.toolsJson && String(ag.toolsJson).length > 2);
    out.push({
      bindingId: b.id,
      agentId: b.agentId,
      agentName: ag.name,
      agentStatus: ag.status,
      siteId: b.siteId,
      siteName: nameBySite.get(b.siteId) ?? b.siteId,
      widgetKey: b.widgetKey,
      hasKnowledge: true,
      toolsEnabled: tools,
    });
  }
  return out;
}

export async function listInboxForClient(userId: number, clientId: string, limit = 100): Promise<InboxRow[]> {
  const client = await getOwnedClientRow(userId, clientId);
  if (!client) return [];
  const db = await getDb();
  const contacts = await db
    .select()
    .from(crm_contacts)
    .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
    .orderBy(desc(crm_contacts.updatedAt))
    .limit(500);
  if (contacts.length === 0) return [];
  const cMap = new Map(contacts.map((c) => [c.id, c]));
  const convs = await db
    .select({ cv: crm_conversations })
    .from(crm_conversations)
    .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
    .where(
      and(
        eq(crm_contacts.userId, userId),
        eq(crm_contacts.clientId, clientId),
      ),
    )
    .orderBy(desc(crm_conversations.lastMessageAt))
    .limit(limit);
  return convs.map((row) => {
    const cv = row.cv;
    const con = cMap.get(cv.contactId ?? "");
    const customFields = con?.customFields;
    return {
      conversation: {
        id: cv.id,
        contactId: cv.contactId,
        channel: cv.channel,
        status: cv.status,
        subject: cv.subject,
        lastMessageAt: cv.lastMessageAt ? new Date(cv.lastMessageAt).toISOString() : null,
        lastMessagePreview: cv.lastMessagePreview,
        unreadCount: cv.unreadCount ?? 0,
      },
      contact: con
        ? {
            id: con.id,
            email: con.email,
            firstName: con.firstName,
            lastName: con.lastName,
            company: con.company,
            leadSource: con.leadSource,
          }
        : null,
      sourceSiteName: readCustomFieldStrings(customFields, ["sourceSiteName", "siteName", "landingPageName"]),
      sourceAgentName: readCustomFieldStrings(customFields, ["sourceAgentName", "agentName"]),
    };
  });
}

export async function getClientSummary(userId: number, clientId: string): Promise<ClientSummary | null> {
  const c = await getOwnedClientRow(userId, clientId);
  if (!c) return null;
  const [roll, sites, leadsMissingFollowUp, campaignsAnyTotal, automationEventsLast7Days] = await Promise.all([
    getClientHubRollupForOwnedClient(userId, clientId, c as ClientAccountRow),
    listSitesForClient(userId, clientId),
    countLeadsMissingFollowUp(userId, clientId),
    countTotalCampaignsForClient(userId, clientId),
    countAutomationEventsLastDays(userId, clientId, 7),
  ]);
  const db = await getDb();
  const primarySite = sites[0]
    ? {
        id: sites[0]!.id,
        name: sites[0]!.name,
        status: sites[0]!.status,
        updatedAt: sites[0]!.updatedAt,
        hasWidget: sites[0]!.hasWidget,
      }
    : null;
  const agRows = await listAgentBindingsForClient(userId, clientId);
  const primaryAgent = agRows[0]
    ? { id: agRows[0]!.agentId, name: agRows[0]!.agentName, status: agRows[0]!.agentStatus, widgetKey: agRows[0]!.widgetKey }
    : null;
  const recent = (await listInboxForClient(userId, clientId, 5)).map((r) => ({
    id: r.conversation.id,
    subject: r.conversation.subject,
    channel: r.conversation.channel,
    lastMessageAt: r.conversation.lastMessageAt,
    lastMessagePreview: r.conversation.lastMessagePreview,
    contactEmail: r.contact?.email ?? null,
  }));
  const recentCamps = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      updatedAt: campaigns.updatedAt,
    })
    .from(campaigns)
    .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)))
    .orderBy(desc(campaigns.updatedAt))
    .limit(3);

  const health = computeClientHealthScoreFromRollup(roll, {
    leadsMissingFollowUp,
    campaignsAnyTotal,
    automationEventsLast7Days,
  });
  const nba = getNextBestClientActionFromContext({
    roll,
    hasPrimarySite: Boolean(primarySite),
    hasPrimaryAgent: Boolean(primaryAgent),
    leadsMissingFollowUp,
    campaignsAnyTotal,
    automationEventsLast7Days,
  });

  return {
    client: {
      id: c.id,
      name: c.name,
      status: c.status,
      workspaceId: c.workspaceId ?? null,
      notes: c.notes ?? null,
      logoUrl: typeof c.logoUrl === "string" && c.logoUrl.trim() ? c.logoUrl : null,
      requestedServices: parseRequestedServices(c.servicesJson),
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : "",
      updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : "",
    },
    metrics: {
      leadsCaptured: roll.leadsCaptured,
      conversations: roll.conversationsOpened,
      conversationsOpened: roll.conversationsOpened,
      openConversations: roll.openConversations,
      bookings: roll.bookings,
      campaignsLaunched: roll.campaignsLaunched,
      websiteVisits: roll.websiteVisits,
      crmMessagesCount: roll.crmMessagesCount,
      widgetMessagesCount: roll.widgetMessagesCount,
      messagesExchanged: roll.messagesExchanged,
      publishedPosts: roll.publishedPosts,
      activeSites: roll.activeSites,
      activeAgents: roll.activeAgents,
      agentInteractions: roll.agentInteractions,
      lastActivityAt: roll.lastActivityAt,
      leadQualifiedCount: roll.leadQualifiedCount,
      followUpCount: roll.followUpCount,
      taskCreatedCount: roll.taskCreatedCount,
      bookingScheduledCount: roll.bookingScheduledCount,
    },
    primarySite,
    primaryAgent,
    recentConversations: recent,
    recentCampaignActivity: recentCamps.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    })),
    nextBestAction: nba.summary,
    nextBestActionDetail: nba.detail,
    health,
  };
}

export async function getClientActivityForClient(
  userId: number,
  clientId: string,
  limit = 30,
): Promise<ClientActivityItem[]> {
  return getClientActivityTimeline(userId, clientId, limit);
}

export async function getClientAnalyticsForClient(
  userId: number,
  clientId: string,
): Promise<ClientAnalyticsResponse | null> {
  const sum = await getClientSummary(userId, clientId);
  if (!sum) return null;
  const m = sum.metrics;
  const posted = m.publishedPosts;
  const leads = m.leadsCaptured;
  const convs = m.conversations;
  const open = m.openConversations;
  const bookings = m.bookings;
  const leadConv =
    leads > 0 && convs > 0 ? Math.round((convs / leads) * 1000) / 10 : null;
  const bookRate =
    convs > 0 && bookings > 0 ? Math.round((bookings / convs) * 1000) / 10 : null;
  const responseVol = m.messagesExchanged;
  return {
    version: 1,
    leadConversion: {
      value: leadConv,
      label: "Lead → conversation (attributed leads vs CRM threads)",
      isPlaceholder: leadConv == null,
      activationHint:
        leadConv == null
          ? "Set clientId on CRM contacts for this account and open at least one thread to see conversion."
          : null,
    },
    agentResponseVolume: {
      value: responseVol,
      label: "Messages exchanged (CRM + widget on client sites)",
      isPlaceholder: responseVol === 0,
      activationHint:
        responseVol === 0
          ? "Drive traffic to the site with the agent widget, or log inbox replies: messages appear in CRM and embed transcripts."
          : null,
    },
    campaignEngagement: {
      value: posted > 0 ? posted : null,
      label: "Posted social pieces (LIVE / COMPLETED campaigns for this client)",
      isPlaceholder: posted === 0,
      activationHint:
        posted === 0
          ? "From Revenue OS, create a client-scoped campaign, approve posts, and mark them POSTED to count here."
          : null,
    },
    bookingRate: {
      value: bookRate,
      label: "Bookings / conversations (calendar or booking channel)",
      isPlaceholder: bookRate == null,
      activationHint:
        bookRate == null
          ? "Add calendar or booking as the conversation channel on a client-attributed contact."
          : null,
    },
    websiteActivity: {
      value: m.widgetMessagesCount > 0 ? m.widgetMessagesCount : null,
      label: "Widget message volume (proxy for on-site activity)",
      isPlaceholder: m.widgetMessagesCount === 0,
      activationHint:
        m.widgetMessagesCount === 0
          ? "Connect an agent to a site linked to this client, embed the chat widget, and receive visitors. Full page-view analytics is not wired to Client Hub yet."
          : "Visitor ↔ agent message count on this client’s embeds.",
    },
    knownMetrics: {
      leadsCaptured: m.leadsCaptured,
      openConversations: open,
      conversations: convs,
      crmMessageCount: m.crmMessagesCount,
      widgetMessageCount: m.widgetMessagesCount,
      messagesExchanged: m.messagesExchanged,
      activeSites: m.activeSites,
      activeAgents: m.activeAgents,
      campaignsLaunched: m.campaignsLaunched,
      publishedPosts: m.publishedPosts,
      lastActivityAt: m.lastActivityAt,
    },
  };
}
