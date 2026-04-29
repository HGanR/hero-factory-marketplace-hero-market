import type { RetDemoPagePayload } from "@/lib/maania/build-ret-demo-payload";
import { applyTroothertzVisualPostProcessToDocument } from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

/**
 * Maps RET/sell demo payload into a Site Builder `SiteSchemaDocument` (single page, `/`).
 */
export function retDemoPayloadToSiteSchemaDocument(payload: RetDemoPagePayload): SiteSchemaDocumentType {
  const doc: SiteSchemaDocumentType = {
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: {
              title: payload.heroTitle,
              subtitle: payload.heroSubtitle,
            },
          },
          {
            type: "section",
            content: {
              title: "Property / deal",
              body: [`Label: ${payload.propertyDealLabel}`, `Owner contact: ${payload.ownerContact}`, `Notes: ${payload.notesLine}`].join(
                "\n"
              ),
            },
          },
          { type: "divider", content: { color: "#334155", thickness: 1 } },
          {
            type: "heading",
            content: { text: "Structure summary" },
          },
          {
            type: "list",
            items: payload.structureSummary.length
              ? payload.structureSummary
              : ["Add structure and token design in RET intake."],
            content: {},
          },
          {
            type: "heading",
            content: { text: "Risk summary" },
          },
          {
            type: "list",
            items: payload.riskSummary,
            content: {},
          },
          ...(payload.jurisdictionSummary.length
            ? ([
                {
                  type: "heading" as const,
                  content: { text: "Jurisdiction" },
                },
                {
                  type: "list" as const,
                  items: payload.jurisdictionSummary,
                  content: {},
                },
              ] as const)
            : []),
          ...(payload.escalationItems.length
            ? ([
                {
                  type: "heading" as const,
                  content: { text: "Escalation items" },
                },
                {
                  type: "list" as const,
                  items: payload.escalationItems,
                  content: {},
                },
              ] as const)
            : []),
          { type: "divider", content: { color: "#334155", thickness: 1 } },
          {
            type: "heading",
            content: { text: "Consultant summary" },
          },
          {
            type: "list",
            items: payload.consultantSummary,
            content: {},
          },
          {
            type: "heading",
            content: { text: "Client-facing summary" },
          },
          {
            type: "list",
            items: payload.clientFacingSummary,
            content: {},
          },
          ...(payload.intelligenceFeatures.length
            ? ([
                {
                  type: "heading" as const,
                  content: { text: "Offer & listing intelligence" },
                },
                {
                  type: "list" as const,
                  items: payload.intelligenceFeatures,
                  content: {},
                },
              ] as const)
            : []),
          {
            type: "call_to_action",
            content: {
              title: "Ready to customize this page?",
              body: "Open the Site Builder to edit blocks, then save or deploy a site version.",
              label: payload.ctaLabel,
              href: "#cta",
            },
          },
        ],
      },
    ],
    metadata: {
      title: `${payload.heroTitle} | MAANIA RET demo`,
      description: payload.heroSubtitle.slice(0, 200),
      theme: {
        styleMode: "corporate",
      },
    },
  };

  applyTroothertzVisualPostProcessToDocument(doc);

  const parsed = SiteSchemaDocument.safeParse(doc);
  if (!parsed.success && process.env.NODE_ENV === "development") {
    console.warn("[retDemoPayloadToSiteSchemaDocument] schema issues", parsed.error.flatten());
  }
  return doc;
}
