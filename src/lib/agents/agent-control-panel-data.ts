import { and, count, desc, eq, isNotNull, ne, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import {
  agentPluginInstallations,
  aiAgentKnowledgeItems,
  aiAgentSiteBindings,
  aiAgents,
  clientAccounts,
  clientPortalRequests,
  web3Sites,
  widgetConversations,
  widgetMessages,
} from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { getClientServiceStatusForOperator } from "@/lib/revenue-os/client-portal-service-db";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-ownership";
import { resolveAgentCapabilities } from "@/lib/agent-plugins/resolve-agent-capabilities";
import { parseWidgetBindingMetadata, type WidgetBindingMetadata } from "@/lib/widget/widget-binding-metadata";
import { buildSuggestedFaqUpdates } from "@/lib/agents/suggested-faq-from-messages";

export type AgentToolsJson = {
  crm?: boolean;
  tasks?: boolean;
  automations?: boolean;
  siteContext?: boolean;
  [k: string]: unknown;
};

export type KnowledgeTypeCount = { type: string; count: number };

export type AgentControlClientRequest = {
  id: string;
  title: string;
  status: "open" | "reviewing" | "completed" | "rejected";
  type: string;
  createdAt: string;
  clientId: string | null;
};

export type AgentControlPanelPayload = {
  agent: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    model: string | null;
    hasCustomLlm: boolean;
    language: string | null;
  };
  tools: AgentToolsJson;
  accessRole: "owner" | "collaborator";
  siteBindingsCount: number;
  /** Primary binding: most recently updated for this agent */
  binding: null | {
    id: string;
    siteId: string;
    siteName: string;
    siteSlug: string | null;
    siteStatus: string;
    clientId: string | null;
    isActive: boolean;
    widgetKey: string;
    allowedDomains: string[];
    metadata: WidgetBindingMetadata;
  };
  client: null | { id: string; name: string };
  service: null | {
    status: string;
    pauseReason: string | null;
  };
  knowledge: {
    total: number;
    byType: KnowledgeTypeCount[];
  };
  capabilities: {
    providerAuthorized: boolean;
    reconnectSuggested: boolean;
    grantedScopeCount: number;
    lastError: string | null;
    /** Enabled plugin keys */
    enabledPlugins: string[];
    /** Executable action keys (authorized + enabled + scopes) */
    executableActionKeys: string[];
  };
  pluginSummary: {
    id: string;
    label: string;
    status: string;
    enabled: boolean;
  }[];
  capabilitySummary: {
    calendar: boolean;
    crm: boolean;
    booking: boolean;
    followup: boolean;
    social: boolean;
  };
  socialToolsHint: { campaignsModule: boolean; customFlags: string[] };
  recentQuestions: { id: string; text: string; at: string }[];
  unresolvedIssues: { id: string; text: string; at: string; errorCode: string | null; status: string }[];
  suggestedFaqUpdates: ReturnType<typeof buildSuggestedFaqUpdates>;
  clientRequests: {
    items: AgentControlClientRequest[];
    backendPending: false;
  };
  safety: {
    authScope: "marketplace_operator" | "unauthorized";
  };
};

function parseToolsJson(raw: string | null | undefined): AgentToolsJson {
  if (!raw?.trim()) return {};
  try {
    const j = JSON.parse(raw) as unknown;
    return j && typeof j === "object" && !Array.isArray(j) ? (j as AgentToolsJson) : {};
  } catch {
    return {};
  }
}

function parseAllowedDomains(raw: string | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return (raw as string[]).filter((x) => typeof x === "string");
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return String(raw)
      .split(/[\n,]/)
      .map((d) => d.trim())
      .filter(Boolean);
  }
}

function collectCustomToolKeys(tools: AgentToolsJson): string[] {
  const known = new Set(["crm", "tasks", "automations", "siteContext"]);
  return Object.keys(tools).filter((k) => !known.has(k));
}

export async function getAgentControlPanelPayload(
  userId: number,
  agentId: string,
  opts?: { isCollaborator?: boolean },
): Promise<AgentControlPanelPayload | null> {
  const ok = await canAccessAgent(agentId, userId);
  if (!ok) return null;
  const accessRole = opts?.isCollaborator ? "collaborator" : "owner";

  await ensureAgentTables();
  await ensureClientPortalTables();
  const db = await getDb();

  const [agentRow] = await db
    .select()
    .from(aiAgents)
    .where(eq(aiAgents.id, agentId))
    .limit(1);
  if (!agentRow) return null;
  if (userId === agentRow.userId && opts?.isCollaborator) {
    /* defensively fix role */
  }
  const isCollaborator = userId !== agentRow.userId;
  if (isCollaborator && !opts) {
    /* re-evaluate when caller only passes userId */
  }
  const effectiveRole: "owner" | "collaborator" = userId === agentRow.userId ? "owner" : "collaborator";
  const ownerId = agentRow.userId;
  const tools = parseToolsJson(agentRow.toolsJson);
  const customFlags = collectCustomToolKeys(tools);
  const socialToolsHint = {
    campaignsModule: process.env.NEXT_PUBLIC_REVENUE_OS_SOCIAL === "1" || customFlags.length > 0,
    customFlags: customFlags.slice(0, 8),
  };

  const [bindingCountRow] = await db
    .select({ c: count() })
    .from(aiAgentSiteBindings)
    .where(eq(aiAgentSiteBindings.agentId, agentId));
  const siteBindingsCount = Number(bindingCountRow?.c ?? 0);

  const bindingRows = await db
    .select({
      binding: aiAgentSiteBindings,
      site: web3Sites,
    })
    .from(aiAgentSiteBindings)
    .innerJoin(web3Sites, eq(web3Sites.id, aiAgentSiteBindings.siteId))
    .where(eq(aiAgentSiteBindings.agentId, agentId))
    .orderBy(desc(aiAgentSiteBindings.updatedAt))
    .limit(1);

  const primary = bindingRows[0];
  let client: AgentControlPanelPayload["client"] = null;
  let service: AgentControlPanelPayload["service"] = null;
  const binding: AgentControlPanelPayload["binding"] = primary
    ? (() => {
        const b = primary.binding;
        const s = primary.site;
        const meta = parseWidgetBindingMetadata(b.metadata);
        return {
          id: b.id,
          siteId: s.id,
          siteName: s.name,
          siteSlug: s.slug ?? null,
          siteStatus: s.status,
          clientId: b.clientId ?? s.clientId ?? null,
          isActive: b.isActive,
          widgetKey: b.widgetKey,
          allowedDomains: parseAllowedDomains(
            typeof b.allowedDomains === "string" ? b.allowedDomains : String(b.allowedDomains ?? ""),
          ),
          metadata: meta,
        };
      })()
    : null;

  if (binding?.clientId) {
    let clientId: string | null = null;
    try {
      assertValidClientId(binding.clientId);
      clientId = binding.clientId;
    } catch {
      clientId = null;
    }
    if (clientId) {
      const [c] = await db
        .select({ id: clientAccounts.id, name: clientAccounts.name })
        .from(clientAccounts)
        .where(and(eq(clientAccounts.id, clientId), eq(clientAccounts.ownerUserId, ownerId)))
        .limit(1);
      if (c) {
        client = { id: c.id, name: c.name };
        const svc = await getClientServiceStatusForOperator(ownerId, c.id);
        if (svc) {
          service = { status: svc.status, pauseReason: svc.pauseReason };
        }
      } else {
        client = { id: clientId, name: "Linked client" };
      }
    }
  }

  const byTypeRows = await db
    .select({ type: aiAgentKnowledgeItems.type, c: count() })
    .from(aiAgentKnowledgeItems)
    .where(eq(aiAgentKnowledgeItems.agentId, agentId))
    .groupBy(aiAgentKnowledgeItems.type);
  const knowledgeByType: KnowledgeTypeCount[] = byTypeRows.map((r) => ({ type: r.type, count: Number(r.c) }));
  const knowledgeTotal = knowledgeByType.reduce((n, t) => n + t.count, 0);

  const resolved = await resolveAgentCapabilities(agentId);
  const instRows = await db
    .select({ pluginKey: agentPluginInstallations.pluginKey, enabled: agentPluginInstallations.enabled })
    .from(agentPluginInstallations)
    .where(eq(agentPluginInstallations.agentId, agentId));
  const enabledPlugins = instRows.filter((r) => r.enabled).map((r) => r.pluginKey);
  const pluginSummary = instRows.map((r) => {
    const key = String(r.pluginKey || "").toLowerCase();
    const label =
      key === "google_calendar"
        ? "Google Calendar"
        : key === "google_gmail"
          ? "Gmail"
          : key
              .split("_")
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(" ");
    return {
      id: r.pluginKey,
      label,
      status: r.enabled ? (resolved.providerAuthorized ? "connected" : "enabled") : "disabled",
      enabled: Boolean(r.enabled),
    };
  });
  const executableSet = new Set(resolved.executableActions.map((a) => a.actionKey.toLowerCase()));
  const capabilitySummary = {
    calendar: executableSet.has("calendar.create_event") || enabledPlugins.includes("google_calendar"),
    crm: Boolean(tools.crm),
    booking:
      executableSet.has("calendar.create_event") ||
      enabledPlugins.includes("google_calendar") ||
      Boolean(tools.tasks),
    followup: executableSet.has("gmail.send_message") || enabledPlugins.includes("google_gmail") || Boolean(tools.automations),
    social: Boolean(socialToolsHint.campaignsModule),
  };

  const lastUser = db
    .select({
      id: widgetMessages.id,
      text: widgetMessages.contentText,
      at: widgetMessages.createdAt,
    })
    .from(widgetMessages)
    .innerJoin(widgetConversations, eq(widgetConversations.id, widgetMessages.conversationId))
    .where(
      and(
        eq(widgetConversations.agentId, agentId),
        eq(widgetConversations.ownerUserId, ownerId),
        eq(widgetMessages.role, "user"),
      ),
    )
    .orderBy(desc(widgetMessages.createdAt))
    .limit(15);
  const recentQRows = await lastUser;

  const unresRows = await db
    .select({
      id: widgetMessages.id,
      text: widgetMessages.contentText,
      at: widgetMessages.createdAt,
      errorCode: widgetMessages.errorCode,
      status: widgetMessages.status,
    })
    .from(widgetMessages)
    .innerJoin(widgetConversations, eq(widgetConversations.id, widgetMessages.conversationId))
    .where(
      and(
        eq(widgetConversations.agentId, agentId),
        eq(widgetConversations.ownerUserId, ownerId),
        eq(widgetMessages.role, "assistant"),
        or(isNotNull(widgetMessages.errorCode), ne(widgetMessages.status, "ok")),
      ),
    )
    .orderBy(desc(widgetMessages.createdAt))
    .limit(8);

  const forFaq = await db
    .select({ text: widgetMessages.contentText })
    .from(widgetMessages)
    .innerJoin(widgetConversations, eq(widgetConversations.id, widgetMessages.conversationId))
    .where(
      and(
        eq(widgetConversations.agentId, agentId),
        eq(widgetConversations.ownerUserId, ownerId),
        eq(widgetMessages.role, "user"),
      ),
    )
    .orderBy(desc(widgetMessages.createdAt))
    .limit(200);

  const faqSugg = buildSuggestedFaqUpdates(
    forFaq.map((r) => r.text).filter((t) => t?.trim().length),
  );

  const reqRows = await db
    .select({
      id: clientPortalRequests.id,
      clientId: clientPortalRequests.clientId,
      type: clientPortalRequests.type,
      title: clientPortalRequests.title,
      status: clientPortalRequests.status,
      createdAt: clientPortalRequests.createdAt,
    })
    .from(clientPortalRequests)
    .where(
      and(
        eq(clientPortalRequests.ownerUserId, ownerId),
        eq(clientPortalRequests.relatedAgentId, agentId),
      ),
    )
    .orderBy(desc(clientPortalRequests.createdAt))
    .limit(10);

  return {
    agent: {
      id: agentRow.id,
      name: agentRow.name,
      description: agentRow.description,
      status: agentRow.status,
      model: agentRow.model,
      hasCustomLlm: Boolean((agentRow.llmEndpoint || "").trim()),
      language: agentRow.language,
    },
    tools,
    accessRole: effectiveRole,
    siteBindingsCount,
    binding,
    client,
    service,
    knowledge: { total: knowledgeTotal, byType: knowledgeByType },
    capabilities: {
      providerAuthorized: resolved.providerAuthorized,
      reconnectSuggested: resolved.gating.reconnectSuggested,
      grantedScopeCount: resolved.grantedScopes.length,
      lastError: resolved.lastError,
      enabledPlugins,
      executableActionKeys: resolved.executableActions.map((a) => a.actionKey),
    },
    pluginSummary,
    capabilitySummary,
    socialToolsHint,
    recentQuestions: recentQRows.map((r) => ({
      id: r.id,
      text: (r.text || "").length > 240 ? `${(r.text || "").slice(0, 240)}…` : r.text || "",
      at: (r.at instanceof Date ? r.at : new Date(String(r.at))).toISOString(),
    })),
    unresolvedIssues: unresRows.map((r) => ({
      id: r.id,
      text: (r.text || "").length > 240 ? `${(r.text || "").slice(0, 240)}…` : r.text || "",
      at: (r.at instanceof Date ? r.at : new Date(String(r.at))).toISOString(),
      errorCode: r.errorCode,
      status: r.status,
    })),
    suggestedFaqUpdates: faqSugg,
    clientRequests: {
      items: reqRows.map((r) => ({
        id: r.id,
        title: r.title,
        status: (r.status as "open" | "reviewing" | "completed" | "rejected") ?? "open",
        type: r.type,
        createdAt: new Date(r.createdAt).toISOString(),
        clientId: r.clientId,
      })),
      backendPending: false,
    },
    safety: { authScope: "marketplace_operator" },
  };
}
