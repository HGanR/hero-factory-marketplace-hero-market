import { describe, expect, it } from "@jest/globals";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  mergeClientLifecycleMetadataIntoDocument,
  mergeClientLifecycleMetadataJson,
  stripSensitiveClientLifecycleForPublicExport,
} from "@/lib/site-builder/client-lifecycle-metadata";

const hubId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function baseDoc() {
  return SiteSchemaDocument.parse({
    pages: [{ slug: "/", blocks: [{ type: "hero", content: { title: "Hello" } }] }],
    metadata: { title: "Site", description: "A site", governance: {} },
  });
}

describe("client-lifecycle-metadata", () => {
  it("adds clientPortal and leadCapture when client id is present", () => {
    const doc = mergeClientLifecycleMetadataIntoDocument(baseDoc(), {
      buildForClient: true,
      siteClientId: hubId,
      agencyBindings: [],
    });
    expect(doc.clientSiteBuild).toBe(true);
    expect(doc.metadata?.clientPortal?.enabled).toBe(true);
    expect(doc.metadata?.clientPortal?.clientId).toBe(hubId);
    expect(doc.metadata?.leadCapture?.clientId).toBe(hubId);
  });

  it("does not add client portal metadata without a uuid client id", () => {
    const doc = mergeClientLifecycleMetadataIntoDocument(baseDoc(), {
      buildForClient: false,
      siteClientId: undefined,
      agencyBindings: [],
    });
    expect(doc.metadata?.clientPortal).toBeUndefined();
    expect(doc.metadata?.leadCapture).toBeUndefined();
  });

  it("mergeClientLifecycleMetadataJson returns error on invalid schema", () => {
    const r = mergeClientLifecycleMetadataJson({}, {
      buildForClient: true,
      siteClientId: hubId,
    });
    expect(r.ok).toBe(false);
  });

  it("sets aiAgent when widget and active binding align", () => {
    let doc = baseDoc();
    doc = SiteSchemaDocument.parse({
      ...doc,
      metadata: {
        ...doc.metadata!,
        widgetIntegration: { widgetKey: "wk_test_12_chars_min", placement: "body_end" as const },
      },
    });
    const merged = mergeClientLifecycleMetadataIntoDocument(doc, {
      buildForClient: true,
      siteClientId: hubId,
      agencyBindings: [
        {
          agentId: "123e4567-e89b-42d3-a456-426614174000",
          widgetKey: "wk_test_12_chars_min",
          agentStatus: "active",
          clientId: hubId,
          isActive: true,
        },
      ],
    });
    expect(merged.metadata?.aiAgent?.agentId).toBe("123e4567-e89b-42d3-a456-426614174000");
    expect(merged.metadata?.aiAgent?.widgetKey).toBe("wk_test_12_chars_min");
  });

  it("stripSensitiveClientLifecycleForPublicExport removes private fields by default", () => {
    const doc = mergeClientLifecycleMetadataIntoDocument(
      SiteSchemaDocument.parse({
        ...baseDoc(),
        metadata: {
          ...baseDoc().metadata!,
          clientId: hubId,
          widgetIntegration: { widgetKey: "wk_test_12_chars_min", placement: "body_end" },
        },
      }),
      {
        buildForClient: true,
        siteClientId: hubId,
        agencyBindings: [
          {
            agentId: "123e4567-e89b-42d3-a456-426614174000",
            widgetKey: "wk_test_12_chars_min",
            isActive: true,
          },
        ],
      },
    );
    const safe = stripSensitiveClientLifecycleForPublicExport(doc);
    expect(safe.metadata?.clientId).toBeUndefined();
    expect(safe.metadata?.leadCapture).toBeUndefined();
    expect(safe.metadata?.aiAgent).toBeUndefined();
    expect(safe.metadata?.clientPortal).toBeUndefined();
  });

  it("stripSensitive keeps minimal portal when showLoginLinkOnSite", () => {
    const doc = SiteSchemaDocument.parse({
      ...baseDoc(),
      metadata: {
        ...baseDoc().metadata!,
        clientPortal: {
          enabled: true,
          clientId: hubId,
          portalUrl: "/client-portal",
          inviteStatus: "active",
          showLoginLinkOnSite: true,
        },
      },
    });
    const safe = stripSensitiveClientLifecycleForPublicExport(doc);
    expect(safe.metadata?.clientPortal).toEqual(
      expect.objectContaining({
        enabled: true,
        portalUrl: "/client-portal",
        showLoginLinkOnSite: true,
      }),
    );
    expect(safe.metadata?.clientPortal?.clientId).toBeUndefined();
  });
});
