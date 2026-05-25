import { normalizeSchemaJsonStringForTargeting } from "@/lib/site-builder/schema/ensure-block-targeting";

export type AssistantImagePlacement =
  | "hero_background"
  | "banner"
  | "card"
  | "gallery"
  | "logo"
  | "section_image";

const PLACEMENT_KEYWORDS: ReadonlyArray<{ placement: AssistantImagePlacement; patterns: RegExp[] }> = [
  {
    placement: "hero_background",
    patterns: [/\bhero\s+background\b/i, /\bbackground\s+hero\b/i, /\bas\s+hero\s+bg\b/i],
  },
  { placement: "banner", patterns: [/\bbanner\b/i, /\bheader\s+image\b/i] },
  { placement: "card", patterns: [/\bcard\b/i, /\btile\b/i] },
  { placement: "gallery", patterns: [/\bgallery\b/i, /\bimage\s+grid\b/i] },
  { placement: "logo", patterns: [/\blogo\b/i, /\bbrand\s+mark\b/i] },
  { placement: "section_image", patterns: [/\bsection\s+image\b/i, /\bimage\s+section\b/i] },
];

export function parseImagePlacementFromPrompt(text: string): AssistantImagePlacement | null {
  const t = text.trim();
  if (!t) return null;
  for (const { placement, patterns } of PLACEMENT_KEYWORDS) {
    for (const re of patterns) {
      if (re.test(t)) return placement;
    }
  }
  return null;
}

/**
 * Removes placement phrases for the resolved target so the remainder can be sent to NL / section pipelines
 * in the same submit as an image apply.
 */
export function stripImagePlacementPhrasesFromPrompt(text: string, placement: AssistantImagePlacement): string {
  const entry = PLACEMENT_KEYWORDS.find((e) => e.placement === placement);
  let t = text;
  if (entry) {
    for (const re of entry.patterns) {
      t = t.replace(re, " ");
    }
  }
  t = t.replace(/\b(use\s+this|put\s+this|attach\s+this|apply\s+this)(\s+as|\s+to|\s+for|\s+in)?\b/gi, " ");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/^(and|then|also|,|;\s*)+/i, "").trim();
  return t;
}

/** When the user attached image(s) but the prompt does not name a placement target. */
export function shouldAskImagePlacement(promptTrimmed: string, attachmentCount: number): boolean {
  if (attachmentCount <= 0) return false;
  return parseImagePlacementFromPrompt(promptTrimmed) == null;
}

export const ASSISTANT_IMAGE_PLACEMENT_PROMPT =
  "Where should I use this image — hero background, banner, card, tile, gallery, section image, or logo? Reply with one of those, then press Enter again.";

type AssetRef = { assetId: string; publicUrl: string; mimeType?: string };

function ensureMetadata(doc: Record<string, unknown>) {
  doc.metadata = (doc.metadata as Record<string, unknown>) || {};
  return doc.metadata as Record<string, unknown>;
}

function ensureSiteAssets(meta: Record<string, unknown>, asset: AssetRef) {
  const prev = (meta.siteBuilderAssets as Record<string, unknown>) || {};
  meta.siteBuilderAssets = {
    ...prev,
    [asset.assetId]: {
      assetId: asset.assetId,
      publicUrl: asset.publicUrl,
      mimeType: asset.mimeType ?? "image/*",
    },
  };
}

/**
 * Applies a previously uploaded asset (already in `metadata.siteBuilderAssets` ideally) to the schema surface
 * implied by `placement`. Returns normalized JSON string.
 */
export function applyAssistantImagePlacement(
  schemaJson: string,
  placement: AssistantImagePlacement,
  asset: AssetRef,
): string {
  const doc = JSON.parse(schemaJson) as Record<string, unknown>;
  const meta = ensureMetadata(doc);
  ensureSiteAssets(meta, asset);

  const pages = (Array.isArray(doc.pages) ? (doc.pages as Array<Record<string, unknown>>) : []) as Array<
    Record<string, unknown>
  >;
  let page0 = pages[0];
  if (!page0) {
    page0 = { slug: "/", blocks: [] as unknown[] };
    pages[0] = page0;
    doc.pages = pages;
  }
  if (!Array.isArray(page0.blocks)) {
    page0.blocks = [];
  }
  const blocks = page0.blocks as Array<Record<string, unknown>>;

  if (placement === "hero_background") {
    const hero = blocks.find((b) => b.type === "hero") || null;
    if (hero) {
      const content = (hero.content = (hero.content as Record<string, unknown>) || {});
      const vis = { ...((content.visual as Record<string, unknown>) || {}) };
      vis.background = {
        type: "image",
        value: asset.publicUrl,
        assetId: asset.assetId,
        behavior: "scroll",
        fallbackColor: "#0f172a",
        mimeType: asset.mimeType,
      };
      content.visual = vis;
    } else {
      blocks.unshift({
        type: "hero",
        content: {
          title: "Welcome",
          subtitle: "",
          visual: {
            background: {
              type: "image",
              value: asset.publicUrl,
              assetId: asset.assetId,
              behavior: "scroll",
              fallbackColor: "#0f172a",
              mimeType: asset.mimeType,
            },
          },
        },
      });
      page0.blocks = blocks;
    }
  } else if (placement === "banner") {
    const hi = blocks.find((b) => b.type === "header_image");
    if (hi) {
      hi.src = asset.publicUrl;
      const c = (hi.content = (hi.content as Record<string, unknown>) || {});
      c.alt = typeof c.alt === "string" ? c.alt : "Banner";
    } else {
      blocks.push({
        type: "header_image",
        src: asset.publicUrl,
        content: { alt: "Banner", fit: "cover" },
      });
      page0.blocks = blocks;
    }
  } else if (placement === "card" || placement === "section_image") {
    const img = blocks.find((b) => b.type === "image");
    if (img) {
      img.src = asset.publicUrl;
      const c = (img.content = (img.content as Record<string, unknown>) || {});
      c.alt = typeof c.alt === "string" ? c.alt : "Image";
    } else {
      blocks.push({ type: "image", src: asset.publicUrl, content: { alt: "Image", fit: "cover" } });
      page0.blocks = blocks;
    }
  } else if (placement === "gallery") {
    const grid = blocks.find((b) => b.type === "image_grid");
    const entry = { src: asset.publicUrl, alt: "Gallery" };
    if (grid) {
      const c = (grid.content = (grid.content as Record<string, unknown>) || {});
      const imgs = Array.isArray(c.images) ? [...(c.images as unknown[])] : [];
      imgs.push(entry);
      c.images = imgs;
    } else {
      blocks.push({ type: "image_grid", content: { images: [entry] } });
      page0.blocks = blocks;
    }
  } else if (placement === "logo") {
    meta.logoUrl = asset.publicUrl;
    const brand = (meta.brand as Record<string, unknown>) || {};
    brand.logoUrl = asset.publicUrl;
    meta.brand = brand;
  }

  doc.pages = pages;
  return normalizeSchemaJsonStringForTargeting(JSON.stringify(doc, null, 2));
}
