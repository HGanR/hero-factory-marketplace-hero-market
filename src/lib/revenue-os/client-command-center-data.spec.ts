import { describe, expect, it } from "@jest/globals";
import { buildConversionReadinessFromSchema } from "@/lib/revenue-os/client-command-center-data";

describe("client command center conversion readiness", () => {
  it("client-linked site exposes conversion readiness from schema", () => {
    const schema = JSON.stringify({
      pages: [
        {
          slug: "/",
          blocks: [{ type: "hero", content: { title: "Welcome", label: "Book", href: "/book" } }],
        },
      ],
      metadata: {},
    });
    const res = buildConversionReadinessFromSchema(schema);
    expect(res).not.toBeNull();
    expect(typeof res?.score).toBe("number");
    expect(Array.isArray(res?.nextBestActions)).toBe(true);
  });
});
import { describe, expect, it } from "@jest/globals";
import { buildDeploymentNodes } from "@/lib/revenue-os/client-command-center-data";

describe("buildDeploymentNodes", () => {
  it("marks all missing when nothing is configured and service active", () => {
    const nodes = buildDeploymentNodes({
      widgetServicePaused: false,
      sites: [],
      hasAgent: false,
      agentStatus: null,
      bindingActive: false,
      leadsCaptured: 0,
      portalActiveUsers: 0,
      portalPendingInvites: 0,
      campaignsLaunched: 0,
    });
    expect(nodes.find((n) => n.key === "website")?.state).toBe("missing");
    expect(nodes.find((n) => n.key === "ai_agent")?.state).toBe("missing");
    expect(nodes.find((n) => n.key === "widget")?.state).toBe("missing");
    expect(nodes.find((n) => n.key === "crm")?.state).toBe("missing");
    expect(nodes.find((n) => n.key === "client_portal")?.state).toBe("missing");
    expect(nodes.find((n) => n.key === "campaigns")?.state).toBe("missing");
  });

  it("pauses website, agent, and widget when service paused", () => {
    const nodes = buildDeploymentNodes({
      widgetServicePaused: true,
      sites: [{ status: "PUBLISHED", hasWidget: true }],
      hasAgent: true,
      agentStatus: "active",
      bindingActive: true,
      leadsCaptured: 5,
      portalActiveUsers: 1,
      campaignsLaunched: 2,
    });
    expect(nodes.find((n) => n.key === "website")?.state).toBe("paused");
    expect(nodes.find((n) => n.key === "ai_agent")?.state).toBe("paused");
    expect(nodes.find((n) => n.key === "widget")?.state).toBe("paused");
  });

  it("connected website when published", () => {
    const nodes = buildDeploymentNodes({
      widgetServicePaused: false,
      sites: [{ status: "PUBLISHED", hasWidget: false }],
      hasAgent: false,
      agentStatus: null,
      bindingActive: false,
      leadsCaptured: 0,
      portalActiveUsers: 0,
      portalPendingInvites: 0,
      campaignsLaunched: 0,
    });
    expect(nodes.find((n) => n.key === "website")?.state).toBe("connected");
  });

  it("warning portal when only pending invites", () => {
    const nodes = buildDeploymentNodes({
      widgetServicePaused: false,
      sites: [],
      hasAgent: false,
      agentStatus: null,
      bindingActive: false,
      leadsCaptured: 0,
      portalActiveUsers: 0,
      portalPendingInvites: 2,
      campaignsLaunched: 0,
    });
    expect(nodes.find((n) => n.key === "client_portal")?.state).toBe("warning");
  });
});
