/**
 * Consultant Client Command Center — all entry points require an owned `client_accounts` row
 * (`getOwnedClientRow` / `client_accounts.ownerUserId = userId`) before any related reads.
 */
import { and, count, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureSiteDomainConnectionsTable } from "@/lib/site-builder/db";
import { listSiteDomainConnectionsForSiteIds } from "@/lib/site-builder/site-domain-connections-repository";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import {
  aiAgentKnowledgeItems,
  aiAgentSiteBindings,
  campaigns,
  clientPortalActivityLog,
  clientPortalInvites,
  clientPortalRequests,
  clientPortalUsers,
  crm_contacts,
  web3SiteVersions,
} from "@/lib/db/schema";
import { evaluateConversionPath } from "@/lib/site-builder/conversion-engine";
import { getClientServiceStatusForOperator } from "@/lib/revenue-os/client-portal-service-db";
import {
  getClientSummary,
  listAgentBindingsForClient,
  listInboxForClient,
  listSitesForClient,
} from "@/lib/revenue-os/client-hub-queries";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";

export type DeploymentNodeKey = "website" | "ai_agent" | "widget" | "crm" | "client_portal" | "campaigns";

export type DeploymentNodeState = "connected" | "missing" | "warning" | "paused";

export type DeploymentNode = {
  key: DeploymentNodeKey;
  label: string;
  state: DeploymentNodeState;
  detail: string;
};

export type CommandCenterFeedbackItem = {
  id: string;
  kind: "client_request" | "ai_issue" | "website_change" | "other";
  title: string;
  preview: string | null;
  at: string | null;
};

export type CommandCenterAgentRow = {
  bindingId: string;
  agentId: string;
  agentName: string;
  agentStatus: string | null;
  siteId: string;
  siteName: string;
  widgetKey: string;
  bindingActive: boolean;
  knowledgeItemCount: number;
  toolsEnabled: boolean;
  allowedDomains: string | null;
  clientServiceStatus: string;
};

export type ClientCommandCenterPayload = {
  client: {
    id: string;
    name: string;
    status: string;
    workspaceId: string | null;
  };
  clientId: string;
  clientName: string;
  accountStatus: string;
  serviceStatus: string;
  servicePauseReason: string | null;
  widgetServicePaused: boolean;
  portalSummary: {
    activeUsers: number;
    pendingInvites: number;
    label: string;
  };
  widgetStatus: "active" | "paused" | "missing";
  sites: Array<{
    id: string;
    name: string;
    status: string;
    hasWidget: boolean;
    widgetKey: string | null;
  }>;
  agentBindingsCount: number;
  lastActivityAt: string | null;
  primarySiteId: string | null;
  primarySiteName: string | null;
  primarySiteStatus: string | null;
  primarySiteHasWidget: boolean;
  primaryAgentId: string | null;
  primaryAgentName: string | null;
  metrics: {
    leadsCaptured: number;
    openConversations: number;
    conversations: number;
    bookings: number;
    campaignsLaunched: number;
    activeSites: number;
    activeAgents: number;
    widgetMessages: number;
    messagesExchanged: number;
  };
  analyticsRollup: {
    leadsCaptured: number;
    conversations: number;
    openConversations: number;
    bookings: number;
    crmMessagesCount: number;
    widgetMessagesCount: number;
    messagesExchanged: number;
    activeSites: number;
    activeAgents: number;
    campaignsLaunched: number;
    lastActivityAt: string | null;
  };
  latestConversations: Array<{
    id: string;
    subject: string | null;
    channel: string;
    status: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    contactEmail: string | null;
  }>;
  latestContacts: Array<{
    id: string;
    name: string | null;
    email: string | null;
    company: string | null;
    updatedAt: string | null;
  }>;
  latestPortalActivity: Array<{
    id: string;
    action: string;
    createdAt: string;
  }>;
  deployment: DeploymentNode[];
  agents: CommandCenterAgentRow[];
  feedbackPreview: CommandCenterFeedbackItem[];
  clientRequests: {
    backendPending: boolean;
    items: Array<{
      id: string;
      type: string;
      title: string;
      status: "open" | "reviewing" | "completed" | "rejected";
      createdAt: string;
    }>;
  };
  /** Custom / Web3 domain wiring for sites linked to this client. */
  domainConnections: Array<{
    siteId: string;
    siteName: string;
    domain: string;
    domainType: string;
    provider: string;
    targetUrl: string;
    status: string;
    lastCheckedAt: string | null;
  }>;
  conversionReadiness?: {
    score: number;
    missingItems: string[];
    nextBestActions: string[];
  } | null;
};

export function buildConversionReadinessFromSchema(
  schemaText: string | null | undefined,
): ClientCommandCenterPayload["conversionReadiness"] {
  if (!schemaText || !schemaText.trim()) return null;
  const audit = evaluateConversionPath(schemaText);
  return {
    score: audit.score,
    missingItems: audit.issues,
    nextBestActions: audit.recommendedActions,
  };
}

function classifyFeedbackRow(subject: string | null, preview: string | null): CommandCenterFeedbackItem["kind"] {
  const t = `${subject ?? ""} ${preview ?? ""}`.toLowerCase();
  if (/\b(hallucinat|incorrect|wrong answer|not working|error|bug|broken ai|bad response)\b/.test(t)) {
    return "ai_issue";
  }
  if (/\b(website|web site|landing page|homepage|copy change|design change|update (the )?site|page edit)\b/.test(t)) {
    return "website_change";
  }
  if (/\b(request|please|need you to|can you|would like|help with|question about)\b/.test(t)) {
    return "client_request";
  }
  return "other";
}

/** Pure deployment map — used by the command center UI and unit tests. */
export function buildDeploymentNodes(args: {
  widgetServicePaused: boolean;
  sites: Array<{ status: string; hasWidget: boolean }>;
  hasAgent: boolean;
  agentStatus: string | null;
  bindingActive: boolean;
  leadsCaptured: number;
  portalActiveUsers: number;
  portalPendingInvites: number;
  campaignsLaunched: number;
}): DeploymentNode[] {
  const publishedSite = args.sites.find((s) => String(s.status).toUpperCase() === "PUBLISHED");
  const anySite = args.sites.length > 0;
  const anyWidget = args.sites.some((s) => s.hasWidget);

  const website: DeploymentNode = (() => {
    if (args.widgetServicePaused) {
      return { key: "website", label: "Website", state: "paused", detail: "Client service pause may block live embeds." };
    }
    if (!anySite) {
      return { key: "website", label: "Website", state: "missing", detail: "No sites linked to this client." };
    }
    if (publishedSite) {
      return { key: "website", label: "Website", state: "connected", detail: "Published site on file." };
    }
    return { key: "website", label: "Website", state: "warning", detail: "Site exists but is not published yet." };
  })();

  const aiAgent: DeploymentNode = (() => {
    if (args.widgetServicePaused) {
      return { key: "ai_agent", label: "AI Agent", state: "paused", detail: "Service pause — widget traffic may be blocked." };
    }
    if (!args.hasAgent) {
      return { key: "ai_agent", label: "AI Agent", state: "missing", detail: "No active agent binding for this client." };
    }
    const st = (args.agentStatus ?? "").toLowerCase();
    if (st && st !== "active" && st !== "live") {
      return { key: "ai_agent", label: "AI Agent", state: "warning", detail: `Agent status: ${args.agentStatus ?? "unknown"}` };
    }
    if (!args.bindingActive) {
      return { key: "ai_agent", label: "AI Agent", state: "warning", detail: "Binding exists but is not active." };
    }
    return { key: "ai_agent", label: "AI Agent", state: "connected", detail: "Active agent binding." };
  })();

  const widget: DeploymentNode = (() => {
    if (args.widgetServicePaused) {
      return { key: "widget", label: "Widget", state: "paused", detail: "Paused at client service layer." };
    }
    if (!anyWidget) {
      return { key: "widget", label: "Widget", state: "missing", detail: "No widget key on linked sites." };
    }
    if (!args.bindingActive && args.hasAgent) {
      return { key: "widget", label: "Widget", state: "warning", detail: "Binding inactive — embed may not load." };
    }
    return { key: "widget", label: "Widget", state: "connected", detail: "Widget metadata / binding present." };
  })();

  const crm: DeploymentNode = (() => {
    if (args.widgetServicePaused) {
      return { key: "crm", label: "CRM", state: "warning", detail: "Service paused — still review open threads." };
    }
    if (args.leadsCaptured <= 0) {
      return { key: "crm", label: "CRM", state: "missing", detail: "No attributed contacts yet." };
    }
    return { key: "crm", label: "CRM", state: "connected", detail: `${args.leadsCaptured} leads captured.` };
  })();

  const clientPortal: DeploymentNode = (() => {
    if (args.portalActiveUsers > 0) {
      return {
        key: "client_portal",
        label: "Client Portal",
        state: "connected",
        detail: `${args.portalActiveUsers} active portal user(s).`,
      };
    }
    if (args.portalPendingInvites > 0) {
      return {
        key: "client_portal",
        label: "Client Portal",
        state: "warning",
        detail: `${args.portalPendingInvites} invite(s) pending acceptance.`,
      };
    }
    return { key: "client_portal", label: "Client Portal", state: "missing", detail: "No active users — send an invite." };
  })();

  const campaignsNode: DeploymentNode = (() => {
    if (args.campaignsLaunched <= 0) {
      return { key: "campaigns", label: "Campaigns", state: "missing", detail: "No launched campaigns for this client." };
    }
    return {
      key: "campaigns",
      label: "Campaigns",
      state: "connected",
      detail: `${args.campaignsLaunched} launched (live or completed).`,
    };
  })();

  return [website, aiAgent, widget, crm, clientPortal, campaignsNode];
}

export async function getClientCommandCenterPayload(
  userId: number,
  clientId: string,
): Promise<ClientCommandCenterPayload | null> {
  await ensureClientHubTables();
  await ensureClientPortalTables();
  await ensureAgentTables();

  const owned = await getOwnedClientRow(userId, clientId);
  if (!owned) return null;

  const [summary, sites, agents, svc, inboxPreview] = await Promise.all([
    getClientSummary(userId, clientId),
    listSitesForClient(userId, clientId),
    listAgentBindingsForClient(userId, clientId),
    getClientServiceStatusForOperator(userId, clientId),
    listInboxForClient(userId, clientId, 12),
  ]);
  if (!summary) return null;

  const db = await getDb();
  const now = new Date();
  const [portalUsersRow, portalInvitesRow, draftCampaignsRow] = await Promise.all([
    db
      .select({ n: count() })
      .from(clientPortalUsers)
      .where(
        and(
          eq(clientPortalUsers.clientId, clientId),
          eq(clientPortalUsers.ownerUserId, userId),
          eq(clientPortalUsers.status, "active"),
        ),
      ),
    db
      .select({ n: count() })
      .from(clientPortalInvites)
      .where(
        and(
          eq(clientPortalInvites.clientId, clientId),
          eq(clientPortalInvites.ownerUserId, userId),
          isNull(clientPortalInvites.acceptedAt),
          isNull(clientPortalInvites.revokedAt),
          gt(clientPortalInvites.expiresAt, now),
        ),
      ),
    db
      .select({ n: count() })
      .from(campaigns)
      .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId), eq(campaigns.status, "DRAFT"))),
  ]);

  const portalActiveUsers = Number(portalUsersRow[0]?.n ?? 0);
  const portalPendingInvites = Number(portalInvitesRow[0]?.n ?? 0);
  const draftCampaigns = Number(draftCampaignsRow[0]?.n ?? 0);

  const siteIds = sites.map((s) => s.id);
  const bindingRows =
    siteIds.length > 0
      ? await db
          .select({
            id: aiAgentSiteBindings.id,
            agentId: aiAgentSiteBindings.agentId,
            siteId: aiAgentSiteBindings.siteId,
            widgetKey: aiAgentSiteBindings.widgetKey,
            isActive: aiAgentSiteBindings.isActive,
            allowedDomains: aiAgentSiteBindings.allowedDomains,
          })
          .from(aiAgentSiteBindings)
          .where(inArray(aiAgentSiteBindings.siteId, siteIds))
      : [];

  const bindByTriple = new Map(
    bindingRows.map((b) => [`${b.agentId}:${b.siteId}:${b.widgetKey}`, b] as const),
  );

  const agentIds = [...new Set(agents.map((a) => a.agentId))];
  const knowledgeCounts =
    agentIds.length > 0
      ? await db
          .select({ agentId: aiAgentKnowledgeItems.agentId, n: count() })
          .from(aiAgentKnowledgeItems)
          .where(inArray(aiAgentKnowledgeItems.agentId, agentIds))
          .groupBy(aiAgentKnowledgeItems.agentId)
      : [];
  const kMap = new Map(knowledgeCounts.map((r) => [r.agentId, Number(r.n ?? 0)]));

  const enrichedAgents: CommandCenterAgentRow[] = agents.map((a) => {
    const b = bindByTriple.get(`${a.agentId}:${a.siteId}:${a.widgetKey}`);
    return {
      bindingId: a.bindingId,
      agentId: a.agentId,
      agentName: a.agentName,
      agentStatus: a.agentStatus,
      siteId: a.siteId,
      siteName: a.siteName,
      widgetKey: a.widgetKey,
      bindingActive: b?.isActive ?? true,
      knowledgeItemCount: kMap.get(a.agentId) ?? 0,
      toolsEnabled: a.toolsEnabled,
      allowedDomains: b?.allowedDomains ?? null,
      clientServiceStatus: svc?.status ?? "active",
    };
  });

  const primary = sites[0];
  const primaryAgent = enrichedAgents[0];
  const activeBindingRow = enrichedAgents.find((x) => x.bindingActive) ?? enrichedAgents[0];
  const widgetPaused =
    (svc?.status ?? "active") === "paused" || (svc?.status ?? "active") === "delinquent" || (svc?.status ?? "active") === "cancelled";

  const deployment = buildDeploymentNodes({
    widgetServicePaused: widgetPaused,
    sites: sites.map((s) => ({ status: s.status, hasWidget: s.hasWidget })),
    hasAgent: enrichedAgents.length > 0,
    agentStatus: activeBindingRow?.agentStatus ?? null,
    bindingActive: activeBindingRow?.bindingActive ?? false,
    leadsCaptured: summary.metrics.leadsCaptured,
    portalActiveUsers,
    portalPendingInvites,
    campaignsLaunched: summary.metrics.campaignsLaunched,
  });

  if (draftCampaigns > 0 && summary.metrics.campaignsLaunched > 0) {
    const i = deployment.findIndex((d) => d.key === "campaigns");
    if (i !== -1 && deployment[i]!.state === "connected") {
      deployment[i] = {
        ...deployment[i]!,
        state: "warning",
        detail: `${deployment[i]!.detail} (${draftCampaigns} draft campaign(s) in queue).`,
      };
    }
  }

  const portalLabel =
    portalActiveUsers > 0
      ? "Active"
      : portalPendingInvites > 0
        ? "Invite pending"
        : portalPendingInvites === 0 && portalActiveUsers === 0
          ? "Not set up"
          : "Unknown";

  const feedbackPreview: CommandCenterFeedbackItem[] = inboxPreview.map((row) => {
    const kind = classifyFeedbackRow(row.conversation.subject, row.conversation.lastMessagePreview);
    return {
      id: row.conversation.id,
      kind,
      title: row.conversation.subject?.trim() || "(no subject)",
      preview: row.conversation.lastMessagePreview,
      at: row.conversation.lastMessageAt,
    };
  });

  const latestConversations = inboxPreview.slice(0, 8).map((r) => ({
    id: r.conversation.id,
    subject: r.conversation.subject,
    channel: r.conversation.channel,
    status: r.conversation.status,
    lastMessageAt: r.conversation.lastMessageAt,
    lastMessagePreview: r.conversation.lastMessagePreview,
    contactEmail: r.contact?.email ?? null,
  }));

  const latestContactsRows = await db
    .select({
      id: crm_contacts.id,
      firstName: crm_contacts.firstName,
      lastName: crm_contacts.lastName,
      email: crm_contacts.email,
      company: crm_contacts.company,
      updatedAt: crm_contacts.updatedAt,
    })
    .from(crm_contacts)
    .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
    .orderBy(desc(crm_contacts.updatedAt))
    .limit(8);

  const latestContacts = latestContactsRows.map((r) => ({
    id: r.id,
    name: [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || null,
    email: r.email ?? null,
    company: r.company ?? null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
  }));

  const latestPortalActivityRows = await db
    .select({
      id: clientPortalActivityLog.id,
      action: clientPortalActivityLog.action,
      createdAt: clientPortalActivityLog.createdAt,
    })
    .from(clientPortalActivityLog)
    .where(eq(clientPortalActivityLog.clientId, clientId))
    .orderBy(desc(clientPortalActivityLog.createdAt))
    .limit(8);

  const latestPortalActivity = latestPortalActivityRows.map((r) => ({
    id: r.id,
    action: r.action,
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  const widgetStatus: "active" | "paused" | "missing" = widgetPaused
    ? "paused"
    : sites.some((s) => s.hasWidget)
      ? "active"
      : "missing";

  const requestRows = await db
    .select({
      id: clientPortalRequests.id,
      type: clientPortalRequests.type,
      title: clientPortalRequests.title,
      status: clientPortalRequests.status,
      createdAt: clientPortalRequests.createdAt,
    })
    .from(clientPortalRequests)
    .where(
      and(
        eq(clientPortalRequests.ownerUserId, userId),
        eq(clientPortalRequests.clientId, clientId),
      ),
    )
    .orderBy(desc(clientPortalRequests.createdAt))
    .limit(8);

  await ensureSiteDomainConnectionsTable(db);
  const siteIdsForDomain = sites.map((s) => s.id);
  const domainRows = await listSiteDomainConnectionsForSiteIds(db, userId, siteIdsForDomain);
  const nameBySite = new Map(sites.map((s) => [s.id, s.name] as const));
  const domainConnections = domainRows.map((r) => ({
    siteId: r.siteId,
    siteName: nameBySite.get(r.siteId) ?? r.siteId,
    domain: r.domain,
    domainType: r.domainType,
    provider: r.provider,
    targetUrl: r.targetUrl,
    status: r.status,
    lastCheckedAt: r.lastCheckedAt
      ? new Date(r.lastCheckedAt as string).toISOString()
      : null,
  }));

  let conversionReadiness: ClientCommandCenterPayload["conversionReadiness"] = null;
  if (primary?.id) {
    const latestSchema = await db
      .select({ schemaJson: web3SiteVersions.schemaJson })
      .from(web3SiteVersions)
      .where(eq(web3SiteVersions.siteId, primary.id))
      .orderBy(desc(web3SiteVersions.version))
      .limit(1);
    conversionReadiness = buildConversionReadinessFromSchema(latestSchema[0]?.schemaJson ?? "");
  }

  return {
    client: {
      id: summary.client.id,
      name: summary.client.name,
      status: summary.client.status,
      workspaceId: summary.client.workspaceId,
    },
    clientId,
    clientName: summary.client.name,
    accountStatus: summary.client.status,
    serviceStatus: svc?.status ?? "active",
    servicePauseReason: svc?.pauseReason ?? null,
    widgetServicePaused: widgetPaused,
    portalSummary: {
      activeUsers: portalActiveUsers,
      pendingInvites: portalPendingInvites,
      label: portalLabel,
    },
    widgetStatus,
    sites: sites.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      hasWidget: s.hasWidget,
      widgetKey: s.widgetKey,
    })),
    agentBindingsCount: enrichedAgents.length,
    lastActivityAt: summary.metrics.lastActivityAt,
    primarySiteId: primary?.id ?? null,
    primarySiteName: primary?.name ?? null,
    primarySiteStatus: primary?.status ?? null,
    primarySiteHasWidget: primary?.hasWidget ?? false,
    primaryAgentId: activeBindingRow?.agentId ?? primaryAgent?.agentId ?? null,
    primaryAgentName: activeBindingRow?.agentName ?? primaryAgent?.agentName ?? null,
    metrics: {
      leadsCaptured: summary.metrics.leadsCaptured,
      conversations: summary.metrics.conversations,
      openConversations: summary.metrics.openConversations,
      bookings: summary.metrics.bookings,
      campaignsLaunched: summary.metrics.campaignsLaunched,
      activeSites: summary.metrics.activeSites,
      activeAgents: summary.metrics.activeAgents,
      widgetMessages: summary.metrics.widgetMessagesCount,
      messagesExchanged: summary.metrics.messagesExchanged,
    },
    analyticsRollup: {
      leadsCaptured: summary.metrics.leadsCaptured,
      conversations: summary.metrics.conversations,
      openConversations: summary.metrics.openConversations,
      bookings: summary.metrics.bookings,
      crmMessagesCount: summary.metrics.crmMessagesCount,
      widgetMessagesCount: summary.metrics.widgetMessagesCount,
      messagesExchanged: summary.metrics.messagesExchanged,
      activeSites: summary.metrics.activeSites,
      activeAgents: summary.metrics.activeAgents,
      campaignsLaunched: summary.metrics.campaignsLaunched,
      lastActivityAt: summary.metrics.lastActivityAt,
    },
    latestConversations,
    latestContacts,
    latestPortalActivity,
    deployment,
    agents: enrichedAgents,
    feedbackPreview,
    clientRequests: {
      backendPending: false,
      items: requestRows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        status: (r.status as "open" | "reviewing" | "completed" | "rejected") ?? "open",
        createdAt: new Date(r.createdAt).toISOString(),
      })),
    },
    domainConnections,
    conversionReadiness,
  };
}
