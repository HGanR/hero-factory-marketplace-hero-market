import { describe, expect, it } from "@jest/globals";
import type { ClientCommandCenterPayload } from "@/lib/revenue-os/client-command-center-data";
import { buildClientQuickActionLinks } from "@/components/client-hub/ClientCommandQuickActions";

function payload(overrides: Partial<ClientCommandCenterPayload> = {}): ClientCommandCenterPayload {
  return {
    client: { id: "c1", name: "Client", status: "active", workspaceId: null },
    clientId: "c1",
    clientName: "Client",
    accountStatus: "active",
    serviceStatus: "active",
    servicePauseReason: null,
    widgetServicePaused: false,
    portalSummary: { activeUsers: 0, pendingInvites: 0, label: "Not set up" },
    widgetStatus: "missing",
    sites: [],
    agentBindingsCount: 0,
    lastActivityAt: null,
    primarySiteId: null,
    primarySiteName: null,
    primarySiteStatus: null,
    primarySiteHasWidget: false,
    primaryAgentId: null,
    primaryAgentName: null,
    metrics: {
      leadsCaptured: 0,
      openConversations: 0,
      conversations: 0,
      bookings: 0,
      campaignsLaunched: 0,
      activeSites: 0,
      activeAgents: 0,
      widgetMessages: 0,
      messagesExchanged: 0,
    },
    analyticsRollup: {
      leadsCaptured: 0,
      conversations: 0,
      openConversations: 0,
      bookings: 0,
      crmMessagesCount: 0,
      widgetMessagesCount: 0,
      messagesExchanged: 0,
      activeSites: 0,
      activeAgents: 0,
      campaignsLaunched: 0,
      lastActivityAt: null,
    },
    latestConversations: [],
    latestContacts: [],
    latestPortalActivity: [],
    deployment: [],
    agents: [],
    feedbackPreview: [],
    clientRequests: { backendPending: true, items: [] },
    domainConnections: [],
    ...overrides,
  };
}

describe("buildClientQuickActionLinks", () => {
  it("builds Site Builder and Agent Control Panel links", () => {
    const links = buildClientQuickActionLinks(
      payload({ clientId: "cid", primarySiteId: "sid", primaryAgentId: "aid" }),
    );
    expect(links.siteBuilderHref).toContain("/site-builder?");
    expect(links.siteBuilderHref).toContain("siteId=sid");
    expect(links.agentControlHref).toBe("/app/agents/aid/control");
    expect(links.portalHref).toBe("/ai-revenue-os/clients/cid/portal");
    expect(links.inboxHref).toBe("/ai-revenue-os/clients/cid/inbox");
  });
});
