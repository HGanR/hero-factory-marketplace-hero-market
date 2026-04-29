import type { BuyerDemoPayload } from "@/lib/maania/build-buyer-demo-payload";
import { applyTroothertzVisualPostProcessToDocument } from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function profileBody(p: BuyerDemoPayload): string {
  const b = p.buyerProfile;
  const lines = [
    `Financing: ${b.financing}`,
    `Budget: ${b.budgetText}`,
    b.targetAreas.length ? `Locations: ${b.targetAreas.join(", ")}` : null,
    `Property type: ${b.propertyType}`,
    `Layout: ${b.bedroomsText} · ${b.bathroomsText}`,
    `Timeline: ${b.timeline}`,
    `Intent: ${b.occupancyGoal}`,
  ].filter(Boolean) as string[];
  return lines.join("\n");
}

function readinessBody(p: BuyerDemoPayload): string {
  const r = p.readiness;
  const lines = [
    `Progress: ${r.answeredCount} of ${r.totalCount} (${r.progressPercent}%)`,
    r.nextBestQuestion ? `Next to refine: ${r.nextBestQuestion}` : "Core intake captured — ready to align showings.",
  ];
  return lines.join("\n");
}

/**
 * Maps a MAANIA buyer demo payload into a Site Builder `SiteSchemaDocument` (single page, `/`).
 * Uses existing block types: hero, section, heading, paragraph, list, divider, call_to_action.
 */
export function buyerDemoPayloadToSiteSchemaDocument(payload: BuyerDemoPayload): SiteSchemaDocumentType {
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
              title: "Buyer profile",
              body: profileBody(payload),
            },
          },
          { type: "divider", content: { color: "#334155", thickness: 1 } },
          {
            type: "heading",
            content: { text: "Priorities & preferences" },
          },
          {
            type: "list",
            items: payload.priorities.length ? payload.priorities : ["Add more detail in MAANIA chat to populate priorities."],
            content: {},
          },
          ...(payload.dealBreakers.length
            ? ([
                {
                  type: "heading" as const,
                  content: { text: "Deal-breakers" },
                },
                {
                  type: "list" as const,
                  items: payload.dealBreakers,
                  content: {},
                },
              ] as const)
            : []),
          { type: "divider", content: { color: "#334155", thickness: 1 } },
          {
            type: "heading",
            content: { text: "Readiness" },
          },
          {
            type: "paragraph",
            content: { text: readinessBody(payload) },
          },
          {
            type: "heading",
            content: { text: "Agent summary (internal)" },
          },
          {
            type: "list",
            items: payload.agentSummary.length ? payload.agentSummary : ["—"],
            content: {},
          },
          {
            type: "heading",
            content: { text: "Client-facing summary" },
          },
          {
            type: "list",
            items: payload.clientFacingSummary.length ? payload.clientFacingSummary : ["—"],
            content: {},
          },
          { type: "divider", content: { color: "#334155", thickness: 1 } },
          {
            type: "paragraph",
            content: { text: `Decision dynamics: ${payload.decisionSummary}` },
          },
          {
            type: "call_to_action",
            content: {
              title: "Next step",
              body: "Share this structured profile with your agent to align tours, offers, and lender strategy.",
              label: payload.ctaLabel,
              href: "#contact",
            },
          },
        ],
      },
    ],
    metadata: {
      title: `${payload.heroTitle} | MAANIA buyer demo`,
      description: `Buyer intake preview — ${payload.readiness.progressPercent}% complete.`,
      theme: {
        styleMode: "corporate",
      },
    },
  };

  applyTroothertzVisualPostProcessToDocument(doc);

  const parsed = SiteSchemaDocument.safeParse(doc);
  if (!parsed.success) {
    console.warn("[buyerDemoPayloadToSiteSchemaDocument] schema validation:", parsed.error.flatten());
  }
  return doc;
}
