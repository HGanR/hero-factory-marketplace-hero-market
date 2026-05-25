import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export type StreamingBuildPhase = "structure" | "content" | "design" | "finalizing";

function sanitize(input?: string, fallback = ""): string {
  return String(input || "").trim() || fallback;
}

function industryLabel(input: SitePlannerInput): string {
  return sanitize(input.industry, "your market");
}

export function createInstantSkeletonSchema(input: SitePlannerInput): SiteSchemaDocumentType {
  const biz = sanitize(input.businessName, "Your Business");
  const offer = sanitize(input.primaryOffer, "Primary offer");
  const audience = sanitize(input.audience, "Your audience");
  const ind = industryLabel(input);

  return {
    pages: [
      {
        slug: "/",
        blocks: [
          {
            type: "hero",
            content: {
              aiSectionId: "stream-hero",
              aiRegistryKey: "hero_primary",
              title: `${biz}`,
              subtitle: `${offer} for ${audience}.`,
              primaryCta: "Loading CTA…",
            },
          },
          {
            type: "section",
            content: {
              aiSectionId: "stream-value-1",
              aiRegistryKey: "value_props",
              title: `Why ${biz}`,
              body: `Preparing section structure for ${ind}…`,
            },
          },
          {
            type: "section",
            content: {
              aiSectionId: "stream-proof-1",
              aiRegistryKey: "social_proof",
              title: "Proof and outcomes",
              body: "Loading proof points…",
            },
          },
          {
            type: "call_to_action",
            content: {
              aiSectionId: "stream-cta-1",
              aiRegistryKey: "cta_primary",
              headline: "Final call to action",
              ctaLabel: "Loading…",
            },
          },
        ],
      },
    ],
    metadata: {
      title: `${biz} — Building preview`,
      removeDefaultCss: false,
      description: `Generating a fast starter preview for ${ind}.`,
      governance: {},
      theme: {
        name: "streaming-preview",
        styleMode: input.web3VisualMode ? "web3" : "minimal",
        backgroundMode: "simple_gradients",
        mediaType: "image",
        gradientStart: "#0f172a",
        gradientEnd: "#1e293b",
      },
    },
  };
}

function updateCopyByPhase(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
  phase: StreamingBuildPhase,
  input: SitePlannerInput,
): void {
  const c = (block.content || {}) as Record<string, unknown>;
  const biz = sanitize(input.businessName, "Your Business");
  const offer = sanitize(input.primaryOffer, "your offer");
  const aud = sanitize(input.audience, "qualified buyers");
  const ind = industryLabel(input);

  if (phase === "content") {
    if (block.type === "hero") {
      c.title = `${offer} that helps ${aud} move faster`;
      c.subtitle = `Built for ${ind}. Launching your tailored copy now.`;
      c.primaryCta = input.web3VisualMode ? "Join the allowlist" : "Book a strategy call";
    }
    if (block.type === "section" && String(c.aiSectionId || "").includes("value")) {
      c.title = `How ${biz} delivers outcomes`;
      c.body = `Specific capabilities for ${ind}, tuned to your audience and conversion goal.`;
    }
    if (block.type === "section" && String(c.aiSectionId || "").includes("proof")) {
      c.title = "Proof that builds trust";
      c.body = "Case-study snippets, social proof, and trust indicators are being generated.";
    }
    if (block.type === "call_to_action") {
      c.headline = "Ready for the next step?";
      c.ctaLabel = input.web3VisualMode ? "View launch readiness" : "Get your growth plan";
    }
  }

  if (phase === "design") {
    const style = { ...((c.style as Record<string, unknown>) || {}) };
    style.backgroundColor =
      block.type === "hero" ? "#0b1220" : block.type === "call_to_action" ? "#1e293b" : "#0f172a";
    style.textColor = "#f8fafc";
    c.style = style;
  }

  if (phase === "finalizing") {
    if (typeof c.subtitle === "string") c.subtitle = `${c.subtitle}`.replace(/\s+Loading[^.]*\.?/gi, "").trim();
    if (typeof c.body === "string") c.body = `${c.body}`.replace(/\s+Loading[^.]*\.?/gi, "").trim();
  }
  block.content = c;
}

export function applyStreamingBuildPhasePatch(
  schema: SiteSchemaDocumentType,
  phase: StreamingBuildPhase,
  input: SitePlannerInput,
): SiteSchemaDocumentType {
  const next = JSON.parse(JSON.stringify(schema)) as SiteSchemaDocumentType;
  const home = next.pages.find((p) => p.slug === "/") ?? next.pages[0];
  if (!home?.blocks) return next;
  for (const b of home.blocks) updateCopyByPhase(b, phase, input);
  if (!next.metadata) {
    next.metadata = { title: "Building preview", removeDefaultCss: false, governance: {} };
  }
  next.metadata.title =
    phase === "finalizing" ? `${sanitize(input.businessName, "Your Business")} — Finalizing…` : next.metadata.title;
  return next;
}
