/**
 * Canonical block templates for programmatic adds — aligned with site-builder UI BLOCK_LIBRARY.
 * Single source for AI / tool layer; keep in sync with `page.tsx` BLOCK_LIBRARY when adding types.
 */

import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export type BlockTemplateKey =
  | "hero"
  | "heading"
  | "paragraph"
  | "section"
  | "button"
  | "image"
  | "footer"
  | "divider"
  | "call_to_action"
  | "link";

function newSectionId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function blockTemplate(
  key: BlockTemplateKey,
  opts?: { aiSectionId?: string; aiRegistryKey?: string },
): SiteSchemaDocumentType["pages"][number]["blocks"][number] {
  const sid = opts?.aiSectionId ?? newSectionId(`ai`);
  const rk = opts?.aiRegistryKey;
  const meta = rk ? { aiSectionId: sid, aiRegistryKey: rk } : { aiSectionId: sid };

  switch (key) {
    case "hero":
      return {
        type: "hero",
        content: {
          ...meta,
          aiRegistryKey: rk ?? "hero_primary",
          title: "New hero headline",
          subtitle: "Supporting line — edit in Refine.",
          visual: {
            gradient: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #0f172a 100%)",
            accent: "#22d3ee",
            gridOverlay: 0.04,
          },
        },
      };
    case "heading":
      return { type: "heading", content: { ...meta, aiRegistryKey: rk ?? "paragraph_intro", text: "Section heading" } };
    case "paragraph":
      return {
        type: "paragraph",
        content: { ...meta, aiRegistryKey: rk ?? "paragraph_intro", text: "Paragraph copy goes here." },
      };
    case "section":
      return {
        type: "section",
        content: {
          ...meta,
          aiRegistryKey: rk ?? "paragraph_intro",
          title: "Section title",
          body: "Section body — replace with your narrative.",
        },
      };
    case "button":
      return {
        type: "button",
        content: { ...meta, aiRegistryKey: rk ?? "mid_cta", label: "Learn more", href: "#" },
      };
    case "image":
      return {
        type: "image",
        src: "",
        content: { ...meta, aiRegistryKey: rk ?? "image_spotlight", alt: "Image" },
      };
    case "footer":
      return {
        type: "footer",
        content: {
          ...meta,
          aiRegistryKey: rk ?? "footer_standard",
          body: "Footer — links and legal.",
        },
      };
    case "divider":
      return { type: "divider", content: { ...meta } };
    case "call_to_action":
      return {
        type: "call_to_action",
        content: {
          ...meta,
          aiRegistryKey: rk ?? "mid_cta",
          title: "Ready to proceed?",
          body: "Short supporting line.",
          label: "Continue",
          href: "#",
        },
      };
    case "link":
      return {
        type: "link",
        content: { ...meta, label: "Open link", href: "#" },
      };
    default:
      return { type: "paragraph", content: { ...meta, text: "Block" } };
  }
}
