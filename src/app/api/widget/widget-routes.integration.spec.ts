/**
 * @jest-environment node
 *
 * Route-level integration tests with mocked DB + LLM. No real MySQL required.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { NextRequest } from "next/server";
import { GET as widgetConfigGET } from "@/app/api/widget/[widgetKey]/config/route";
import { POST as widgetMessagePOST } from "@/app/api/widget/[widgetKey]/message/route";
import { POST as builderActionsPOST } from "@/app/api/site-builder/builder-actions/route";
import { aiAgentSiteBindings, aiAgents, aiAgentKnowledgeItems } from "@/lib/db/schema";
import * as agentRuntime from "@/lib/agents/agent-tool-runtime";
import * as providerResolver from "@/lib/site-builder/ai/provider-resolver";
import * as siteGrounding from "@/lib/widget/site-widget-grounding";
import * as wconv from "@/lib/widget/widget-conversation-service";

const mockGetDb = jest.fn();

jest.mock("@/lib/db", () => ({
  getDb: () => mockGetDb(),
}));

jest.mock("@/lib/db/crm-ensure", () => ({
  ensureCrmTables: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/widget/crm-logger", () => ({
  logWebChatMessage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/maania/maania-deterministic-reply", () => ({
  tryMaaniaDeterministicReply: jest.fn().mockReturnValue(null),
}));

jest.mock("@/lib/api/auth", () => ({
  getAuthedUserId: jest.fn(),
}));

function mkBindingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    bindingId: "bind-1",
    widgetKey: "testwidgetkey_integration_01",
    agentId: "agent-1",
    agentName: "Integration Test Agent",
    userId: 99,
    siteId: "site-1",
    bindingClientId: null,
    siteName: "Test Site",
    bindingMetadata: null,
    systemPrompt: "You are a test assistant.",
    language: null,
    industriesJson: null,
    status: "active",
    allowedDomains: null,
    llmEndpoint: null,
    llmApiKeyEnc: null,
    model: "gpt-test",
    ...overrides,
  };
}

function mkDb(bindingRow: ReturnType<typeof mkBindingRow>) {
  return {
    select: (_fields?: unknown) => ({
      from: (t: unknown) => {
        if (t === aiAgentSiteBindings) {
          const end = {
            where: () => ({
              limit: () => Promise.resolve([bindingRow]),
            }),
          };
          // Config: one join then `.where`. Message: two joins then `.where`.
          return {
            innerJoin: () => ({
              innerJoin: () => end,
              where: end.where,
            }),
          };
        }
        if (t === aiAgentKnowledgeItems) {
          return {
            where: () => ({
              orderBy: () => Promise.resolve([]),
            }),
          };
        }
        return {
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        };
      },
    }),
  };
}

describe("widget config route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns safe config for valid active widget (no secrets)", async () => {
    mockGetDb.mockResolvedValue(
      mkDb(
        mkBindingRow({
          metadata: {
            widgetAppearance: {
              avatarImageUrl: "data:image/png;base64,aaaa",
              avatarAltText: "Assistant",
              avatarBorderColor: "#123456",
            },
          },
        }),
      ),
    );
    const req = new NextRequest("http://localhost/api/widget/testwidgetkey_integration_01/config", {
      headers: { origin: "https://localhost" },
    });
    const res = await widgetConfigGET(req, { params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }) });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { config: Record<string, unknown> };
    const flat = JSON.stringify(j);
    expect(flat.toLowerCase()).not.toContain("apikey");
    expect(flat.toLowerCase()).not.toContain("llmapikey");
    expect(j.config.name).toBeTruthy();
    expect(j.config.endpoints).toBeTruthy();
    expect((j.config as Record<string, unknown>).widgetAppearance).toBeTruthy();
    expect(flat).not.toContain("clientId");
  });

  it("returns 404 for inactive agent", async () => {
    mockGetDb.mockResolvedValue(mkDb(mkBindingRow({ status: "draft" })));
    const req = new NextRequest("http://localhost/api/widget/testwidgetkey_integration_01/config");
    const res = await widgetConfigGET(req, { params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when origin not allowed", async () => {
    mockGetDb.mockResolvedValue(
      mkDb(mkBindingRow({ allowedDomains: JSON.stringify(["good.com"]) })),
    );
    const req = new NextRequest("http://localhost/api/widget/testwidgetkey_integration_01/config", {
      headers: { origin: "https://evil.com" },
    });
    const res = await widgetConfigGET(req, { params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }) });
    expect(res.status).toBe(403);
  });
});

describe("widget message route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(wconv, "getOrResumeWidgetConversation").mockResolvedValue({
      internalId: "conv-int",
      publicId: "conv-pub-initial",
      resumed: false,
    });
    jest.spyOn(wconv, "appendWidgetMessage").mockResolvedValue(undefined);
    jest.spyOn(providerResolver, "resolveSiteBuilderLlmInvokeForSite").mockResolvedValue({
      invokeLlm: async () => "SITE_BUILDER_REPLY",
      source: "managed",
    });
    jest.spyOn(siteGrounding, "loadSiteSummaryTextForWidget").mockResolvedValue(null);
    jest.spyOn(agentRuntime, "runAgentLlmReply").mockImplementation(async (p) => {
      if (p.overridePlainLlmInvoke) {
        const r = await p.overridePlainLlmInvoke([
          { role: "system", content: p.systemPrompt },
          { role: "user", content: p.userMessage },
        ]);
        return { reply: r, telemetry: { mode: "plain" as const } };
      }
      return { reply: "AGENT_DEFAULT_REPLY", telemetry: { mode: "plain" as const } };
    });
  });

  it("returns conversationId and persists via service", async () => {
    mockGetDb.mockResolvedValue(mkDb(mkBindingRow()));
    const req = new NextRequest("http://localhost/api/widget/testwidgetkey_integration_01/message", {
      method: "POST",
      headers: { origin: "https://localhost", "content-type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });
    const res = await widgetMessagePOST(req, {
      params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }),
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { reply: string; conversationId: string };
    expect(j.conversationId).toBe("conv-pub-initial");
    expect(j.reply).toBe("AGENT_DEFAULT_REPLY");
    expect(wconv.getOrResumeWidgetConversation).toHaveBeenCalled();
    expect(wconv.appendWidgetMessage).toHaveBeenCalled();
    const roles = (wconv.appendWidgetMessage as jest.Mock).mock.calls.map((c) => c[1].role);
    expect(roles).toContain("user");
    expect(roles).toContain("assistant");
  });

  it("second message passes conversationId for resume", async () => {
    mockGetDb.mockResolvedValue(mkDb(mkBindingRow()));
    const spy = wconv.getOrResumeWidgetConversation as jest.Mock;
    spy.mockClear();
    const body = (cid?: string) =>
      JSON.stringify({
        message: "Again",
        ...(cid ? { conversationId: cid } : {}),
      });
    const req1 = new NextRequest("http://localhost/api/widget/k/message", {
      method: "POST",
      headers: { origin: "https://localhost", "content-type": "application/json" },
      body: body(),
    });
    await widgetMessagePOST(req1, { params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }) });
    const req2 = new NextRequest("http://localhost/api/widget/k/message", {
      method: "POST",
      headers: { origin: "https://localhost", "content-type": "application/json" },
      body: body("conv-pub-initial"),
    });
    await widgetMessagePOST(req2, { params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }) });
    expect(spy.mock.calls[1][1].publicConversationIdFromClient).toBe("conv-pub-initial");
  });

  it("blocks disallowed origin before conversation", async () => {
    mockGetDb.mockResolvedValue(
      mkDb(mkBindingRow({ allowedDomains: JSON.stringify(["allowed.example"]) })),
    );
    const req = new NextRequest("http://localhost/api/widget/k/message", {
      method: "POST",
      headers: { origin: "https://other.example", "content-type": "application/json" },
      body: JSON.stringify({ message: "Hi" }),
    });
    const res = await widgetMessagePOST(req, {
      params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }),
    });
    expect(res.status).toBe(403);
    expect(wconv.getOrResumeWidgetConversation).not.toHaveBeenCalled();
  });

  it("uses site_builder LLM path when binding metadata says so", async () => {
    mockGetDb.mockResolvedValue(
      mkDb(
        mkBindingRow({
          bindingMetadata: { providerStrategy: "site_builder" },
        }),
      ),
    );
    const req = new NextRequest("http://localhost/api/widget/k/message", {
      method: "POST",
      headers: { origin: "https://localhost", "content-type": "application/json" },
      body: JSON.stringify({ message: "Hi" }),
    });
    const res = await widgetMessagePOST(req, {
      params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }),
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { reply: string };
    expect(j.reply).toBe("SITE_BUILDER_REPLY");
  });

  it("injects site snapshot when grounding returns text", async () => {
    jest.spyOn(siteGrounding, "loadSiteSummaryTextForWidget").mockResolvedValue("SNAPSHOT_LINE");
    mockGetDb.mockResolvedValue(
      mkDb(
        mkBindingRow({
          bindingMetadata: { siteGrounding: true },
        }),
      ),
    );
    const llm = agentRuntime.runAgentLlmReply as jest.Mock;
    llm.mockClear();
    const req = new NextRequest("http://localhost/api/widget/k/message", {
      method: "POST",
      headers: { origin: "https://localhost", "content-type": "application/json" },
      body: JSON.stringify({ message: "Hi" }),
    });
    await widgetMessagePOST(req, {
      params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }),
    });
    const sys = String(llm.mock.calls[0][0].systemPrompt);
    expect(sys).toContain("SNAPSHOT_LINE");
  });

  it("response JSON never includes provider secrets", async () => {
    mockGetDb.mockResolvedValue(mkDb(mkBindingRow()));
    const req = new NextRequest("http://localhost/api/widget/k/message", {
      method: "POST",
      headers: { origin: "https://localhost", "content-type": "application/json" },
      body: JSON.stringify({ message: "Hi" }),
    });
    const res = await widgetMessagePOST(req, {
      params: Promise.resolve({ widgetKey: "testwidgetkey_integration_01" }),
    });
    const raw = await res.text();
    expect(raw.toLowerCase()).not.toContain("llmapikey");
    expect(raw.toLowerCase()).not.toContain("secret");
  });
});

describe("public vs privileged routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builder-actions rejects unauthenticated requests", async () => {
    const { getAuthedUserId } = await import("@/lib/api/auth");
    (getAuthedUserId as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost/api/site-builder/builder-actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaJson: { pages: [{ slug: "/", blocks: [] }], metadata: { title: "T", governance: {} } },
        actions: [],
      }),
    });
    const res = await builderActionsPOST(req);
    expect(res.status).toBe(401);
  });
});
