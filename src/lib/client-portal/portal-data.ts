import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { aiAgentSiteBindings, crm_contacts, crm_conversations, clientServiceStatus } from "@/lib/db/schema";
import type { ClientAccountRow, ClientHubRollup } from "@/lib/revenue-os/client-hub-types";
import { getClientHubRollupForOwnedClient } from "@/lib/revenue-os/client-hub-rollup";
import { listAgentBindingsForClient, listInboxForClient, listSitesForClient } from "@/lib/revenue-os/client-hub-queries";
import type { ClientPortalSessionState } from "./portal-session";
import { parseWidgetBindingMetadata } from "@/lib/widget/widget-binding-metadata";

export type ClientPortalSafeRollup = {
  leadsCaptured: number;
  conversationsOpened: number;
  openConversations: number;
  bookings: number;
  crmMessageVolume: number;
  widgetMessageVolume: number;
  lastActivityAt: string | null;
  activeSites: number;
  activeAgents: number;
};

/**
 * No operator-only intelligence fields; no raw site/agent UUIDs in rollup for MVP.
 */
function toSafeRollup(roll: ClientHubRollup): ClientPortalSafeRollup {
  return {
    leadsCaptured: roll.leadsCaptured,
    conversationsOpened: roll.conversationsOpened,
    openConversations: roll.openConversations,
    bookings: roll.bookings,
    crmMessageVolume: roll.crmMessagesCount,
    widgetMessageVolume: roll.widgetMessagesCount,
    lastActivityAt: roll.lastActivityAt,
    activeSites: roll.activeSites,
    activeAgents: roll.activeAgents,
  };
}

export type ClientPortalOverview = {
  business: { name: string };
  service: {
    status: string;
    showServiceBanner: boolean;
    isDelinquent: boolean;
  };
  website: { hasPublishedSite: boolean; siteCount: number };
  aiAgent: { isActive: boolean; label: string };
  stats: {
    leadsCaptured: number;
    openConversations: number;
    bookings: number;
    agentMessageVolume: number;
    lastActivityAt: string | null;
  };
  recent: {
    conversations: Array<{
      subject: string | null;
      channel: string;
      lastMessageAt: string | null;
      lastMessagePreview: string | null;
    }>;
  };
};

export async function getClientPortalRollupForPortalUser(
  s: ClientPortalSessionState,
): Promise<ClientPortalSafeRollup> {
  const account = s.client;
  const roll = await getClientHubRollupForOwnedClient(s.tokenPayload.ownerUserId, s.tokenPayload.clientId, account, {
    skipIntelligenceWriteback: true,
  });
  return toSafeRollup(roll);
}

export async function getClientPortalOverviewForPortalUser(s: ClientPortalSessionState): Promise<ClientPortalOverview> {
  const ownerUserId = s.tokenPayload.ownerUserId;
  const clientId = s.tokenPayload.clientId;
  const [roll, sites, agents, inbox] = await Promise.all([
    getClientHubRollupForOwnedClient(ownerUserId, clientId, s.client as ClientAccountRow, {
      skipIntelligenceWriteback: true,
    }),
    listSitesForClient(ownerUserId, clientId),
    listAgentBindingsForClient(ownerUserId, clientId),
    listInboxForClient(ownerUserId, clientId, 8),
  ]);
  await ensureClientPortalTables();
  const db = await getDb();
  const [svc] = await db
    .select()
    .from(clientServiceStatus)
    .where(eq(clientServiceStatus.clientId, clientId))
    .limit(1);
  const svcStatus = (svc?.status ?? "active") as string;
  const isDelinquent = svcStatus === "delinquent";
  const showServiceBanner = svcStatus === "paused" || isDelinquent;

  const hasPublished = sites.length > 0;
  const agentActive = agents.length > 0 && agents.some((a) => a.agentStatus === "active");

  return {
    business: { name: s.client.name },
    service: { status: svcStatus, showServiceBanner, isDelinquent },
    website: { hasPublishedSite: hasPublished, siteCount: sites.length },
    aiAgent: { isActive: agentActive, label: agents[0]?.agentName ?? "—" },
    stats: {
      leadsCaptured: roll.leadsCaptured,
      openConversations: roll.openConversations,
      bookings: roll.bookings,
      agentMessageVolume: roll.widgetMessagesCount,
      lastActivityAt: roll.lastActivityAt,
    },
    recent: {
      conversations: inbox.map((r) => ({
        subject: r.conversation.subject,
        channel: r.conversation.channel,
        lastMessageAt: r.conversation.lastMessageAt,
        lastMessagePreview: r.conversation.lastMessagePreview,
      })),
    },
  };
}

export type PortalConversationRow = Awaited<ReturnType<typeof listClientPortalConversations>>[number];
export type PortalContactRow = Awaited<ReturnType<typeof listClientPortalContacts>>[number];

export async function listClientPortalConversations(
  s: ClientPortalSessionState,
  limit = 50,
) {
  const userId = s.tokenPayload.ownerUserId;
  const clientId = s.tokenPayload.clientId;
  const rows = await listInboxForClient(userId, clientId, limit);
  return rows.map((r) => ({
    id: r.conversation.id,
    channel: r.conversation.channel,
    status: r.conversation.status,
    subject: r.conversation.subject,
    lastMessageAt: r.conversation.lastMessageAt,
    lastMessagePreview: r.conversation.lastMessagePreview,
    contact: r.contact
      ? {
          firstName: r.contact.firstName,
          lastName: r.contact.lastName,
          email: r.contact.email,
          company: r.contact.company,
        }
      : null,
  }));
}

export async function listClientPortalContacts(
  s: ClientPortalSessionState,
  limit = 100,
) {
  await ensureCrmTables();
  const userId = s.tokenPayload.ownerUserId;
  const clientId = s.tokenPayload.clientId;
  const db = await getDb();
  return db
    .select({
      id: crm_contacts.id,
      email: crm_contacts.email,
      firstName: crm_contacts.firstName,
      lastName: crm_contacts.lastName,
      company: crm_contacts.company,
      leadSource: crm_contacts.leadSource,
      status: crm_contacts.status,
      updatedAt: crm_contacts.updatedAt,
    })
    .from(crm_contacts)
    .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
    .orderBy(desc(crm_contacts.updatedAt))
    .limit(limit);
}

export type ClientPortalAgentSummary = {
  hasBinding: boolean;
  agentName: string;
  status: string | null;
  widgetEnabled: boolean;
  siteName: string;
  avatarImageUrl: string | null;
  avatarAltText: string | null;
  widgetAppearance: {
    avatarBorderColor: string | null;
    avatarBorderWidth: number | null;
    widgetBubbleColor: string | null;
    widgetWindowBackgroundColor: string | null;
    widgetHeaderColor: string | null;
    widgetTextColor: string | null;
    widgetAccentColor: string | null;
  };
};

export async function getClientPortalAgentSummary(s: ClientPortalSessionState): Promise<ClientPortalAgentSummary> {
  const list = await listAgentBindingsForClient(s.tokenPayload.ownerUserId, s.tokenPayload.clientId);
  if (list.length === 0) {
    return {
      hasBinding: false,
      agentName: "—",
      status: null,
      widgetEnabled: false,
      siteName: "—",
      avatarImageUrl: null,
      avatarAltText: null,
      widgetAppearance: {
        avatarBorderColor: null,
        avatarBorderWidth: null,
        widgetBubbleColor: null,
        widgetWindowBackgroundColor: null,
        widgetHeaderColor: null,
        widgetTextColor: null,
        widgetAccentColor: null,
      },
    };
  }
  const a = list[0]!;
  const db = await getDb();
  const [binding] = await db
    .select({ metadata: aiAgentSiteBindings.metadata })
    .from(aiAgentSiteBindings)
    .where(eq(aiAgentSiteBindings.id, a.bindingId))
    .limit(1);
  const meta = parseWidgetBindingMetadata(binding?.metadata ?? null);
  const wa = meta.widgetAppearance;
  return {
    hasBinding: true,
    agentName: a.agentName,
    status: a.agentStatus,
    widgetEnabled: Boolean(a.widgetKey),
    siteName: a.siteName,
    avatarImageUrl: wa?.avatarImageUrl ?? null,
    avatarAltText: wa?.avatarAltText ?? null,
    widgetAppearance: {
      avatarBorderColor: wa?.avatarBorderColor ?? null,
      avatarBorderWidth: wa?.avatarBorderWidth ?? null,
      widgetBubbleColor: wa?.widgetBubbleColor ?? null,
      widgetWindowBackgroundColor: wa?.widgetWindowBackgroundColor ?? null,
      widgetHeaderColor: wa?.widgetHeaderColor ?? null,
      widgetTextColor: wa?.widgetTextColor ?? null,
      widgetAccentColor: wa?.widgetAccentColor ?? null,
    },
  };
}
