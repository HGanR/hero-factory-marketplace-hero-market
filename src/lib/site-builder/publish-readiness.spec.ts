import { describe, expect, it } from "@jest/globals";
import {
  clientPortalHandoffSynced,
  clientPortalInviteSatisfied,
  computePublishChecklist,
  hasWidgetInSchema,
  isSeoBasicsPresent,
  SCHEMA_SIZE_WARN_BYTES,
  schemaSizeWarning,
} from "@/lib/site-builder/publish-readiness";

const minimalSchema = (over: Record<string, unknown> = {}) =>
  ({
    pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "T" } }] }],
    metadata: { title: "My Site", description: "A short site description for SEO." },
    ...over,
  }) as unknown;

describe("publish-readiness", () => {
  it("computePublishChecklist requires version, draft, seo, mobile, and agent or skip", () => {
    const base = {
      buildForClient: false,
      siteClientId: null,
      parsedSchema: minimalSchema(),
      agencyBindings: [],
      postLayoutAgentSkipped: false,
      portalInviteBypass: false,
      mobilePreviewOk: false,
      layoutGenComplete: true,
      versionsCount: 0,
    };
    const a = computePublishChecklist(base);
    expect(a.find((i) => i.id === "version")?.done).toBe(false);
    expect(a.find((i) => i.id === "draft")?.done).toBe(true);
    expect(a.find((i) => i.id === "seo")?.done).toBe(true);
    expect(a.find((i) => i.id === "mobile")?.done).toBe(false);
    expect(a.find((i) => i.id === "agent")?.done).toBe(false);

    const b = computePublishChecklist({
      ...base,
      versionsCount: 1,
      postLayoutAgentSkipped: true,
      mobilePreviewOk: true,
    });
    expect(b.every((i) => i.done)).toBe(true);
    expect(b.some((i) => i.id === "client_portal")).toBe(false);
  });

  it("build-for-client requires site client id", () => {
    const items = computePublishChecklist({
      buildForClient: true,
      siteClientId: "",
      parsedSchema: minimalSchema(),
      agencyBindings: [],
      postLayoutAgentSkipped: true,
      portalInviteBypass: false,
      mobilePreviewOk: true,
      layoutGenComplete: true,
      versionsCount: 1,
    });
    expect(items.find((i) => i.id === "client")?.done).toBe(false);
    const hubId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const ok = computePublishChecklist({
      buildForClient: true,
      siteClientId: hubId,
      parsedSchema: minimalSchema({
        clientSiteBuild: true,
        metadata: {
          title: "My Site",
          description: "A short site description for SEO.",
          clientPortal: {
            enabled: true,
            clientId: hubId,
            portalUrl: "/client-portal",
            inviteStatus: "invited",
            showLoginLinkOnSite: false,
          },
        },
      }),
      agencyBindings: [],
      postLayoutAgentSkipped: true,
      portalInviteBypass: false,
      mobilePreviewOk: true,
      layoutGenComplete: true,
      versionsCount: 1,
    });
    expect(ok.find((i) => i.id === "client")?.done).toBe(true);
    expect(ok.find((i) => i.id === "client_portal")?.done).toBe(true);
    expect(ok.find((i) => i.id === "client_portal_invite")?.done).toBe(true);
  });

  it("client portal invite checklist can be bypassed per session flag", () => {
    const hubId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const schema = minimalSchema({
      clientSiteBuild: true,
      metadata: {
        title: "My Site",
        description: "A short site description for SEO.",
        clientPortal: {
          enabled: true,
          clientId: hubId,
          portalUrl: "/client-portal",
          inviteStatus: "not_invited",
          showLoginLinkOnSite: false,
        },
      },
    });
    const blocked = computePublishChecklist({
      buildForClient: true,
      siteClientId: hubId,
      parsedSchema: schema,
      agencyBindings: [],
      postLayoutAgentSkipped: true,
      portalInviteBypass: false,
      mobilePreviewOk: true,
      layoutGenComplete: true,
      versionsCount: 1,
    });
    expect(blocked.find((i) => i.id === "client_portal_invite")?.done).toBe(false);
    const skipped = computePublishChecklist({
      buildForClient: true,
      siteClientId: hubId,
      parsedSchema: schema,
      agencyBindings: [],
      postLayoutAgentSkipped: true,
      portalInviteBypass: true,
      mobilePreviewOk: true,
      layoutGenComplete: true,
      versionsCount: 1,
    });
    expect(skipped.find((i) => i.id === "client_portal_invite")?.done).toBe(true);
  });

  it("clientPortalHandoffSynced and clientPortalInviteSatisfied", () => {
    const hubId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const doc = minimalSchema({
      metadata: {
        title: "T",
        description: "D".repeat(10),
        clientPortal: { enabled: true, clientId: hubId, inviteStatus: "not_invited" },
      },
    });
    expect(clientPortalHandoffSynced(doc, hubId)).toBe(true);
    expect(clientPortalHandoffSynced(doc, "c47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(false);
    expect(clientPortalInviteSatisfied(doc, false)).toBe(false);
    expect(clientPortalInviteSatisfied(doc, true)).toBe(true);
    expect(
      clientPortalInviteSatisfied(
        minimalSchema({
          metadata: {
            title: "T",
            description: "D".repeat(10),
            clientPortal: { enabled: true, clientId: hubId, inviteStatus: "active" },
          },
        }),
        false,
      ),
    ).toBe(true);
  });

  it("isSeoBasicsPresent respects minimum length", () => {
    expect(isSeoBasicsPresent(minimalSchema({ metadata: { title: "ab", description: "okokok" } }))).toBe(false);
    expect(isSeoBasicsPresent(minimalSchema({ metadata: { title: "abc", description: "def" } }))).toBe(true);
  });

  it("hasWidgetInSchema reads metadata.widgetIntegration.widgetKey", () => {
    expect(hasWidgetInSchema(minimalSchema())).toBe(false);
    expect(
      hasWidgetInSchema(
        minimalSchema({
          metadata: {
            title: "T",
            description: "D".repeat(10),
            widgetIntegration: { widgetKey: "wk_test" },
          },
        }),
      ),
    ).toBe(true);
  });

  it("schemaSizeWarning flags very large JSON", () => {
    const small = schemaSizeWarning("{}");
    expect(small.warn).toBe(false);
    const big = schemaSizeWarning("x".repeat(SCHEMA_SIZE_WARN_BYTES + 1));
    expect(big.warn).toBe(true);
  });
});
