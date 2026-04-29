import type { CSSProperties } from "react";

export function getBlockPlacement(block: unknown): "left" | "center" | "right" {
  const align = String((block as { content?: { align?: string } })?.content?.align || "left");
  return align === "center" || align === "right" ? align : "left";
}

export function getBlockStyle(block: unknown): CSSProperties {
  const b = block as { type?: string; content?: { style?: Record<string, unknown> } };
  const s = b?.content?.style || {};
  const isAvatar = String(b?.type || "") === "avatar";
  return {
    color: (s.textColor as string) || undefined,
    fontFamily: (s.fontFamily as string) || undefined,
    backgroundColor: (s.backgroundColor as string) || undefined,
    borderColor: isAvatar ? undefined : (s.borderColor as string) || undefined,
    borderWidth: isAvatar ? undefined : typeof s.borderWidth === "number" ? `${s.borderWidth}px` : undefined,
    borderStyle: isAvatar ? undefined : s.borderWidth ? (String(s.borderStyle || "solid") as "solid" | "dashed") : undefined,
    borderRadius: isAvatar ? undefined : typeof s.borderRadius === "number" ? `${s.borderRadius}px` : undefined,
    textAlign: (s.textAlign as CSSProperties["textAlign"]) || undefined,
    padding: isAvatar ? "0px" : "12px",
  };
}

/** Identity for on-canvas Refine targeting (first page preview). */
export function getPreviewBlockSectionMeta(raw: unknown): { sectionId: string | null; sectionType: string } {
  const b = raw as { type?: string; content?: { aiSectionId?: string } } | null | undefined;
  const sectionId = String(b?.content?.aiSectionId || "").trim() || null;
  const sectionType = String(b?.type || "");
  return { sectionId, sectionType };
}

const TYPE_FRIENDLY: Record<string, string> = {
  hero: "Hero",
  text: "Text",
  image: "Image",
  button: "Button",
  section: "Section",
  footer: "Footer",
  avatar: "Avatar",
  heading: "Heading",
  paragraph: "Paragraph",
  link: "Link",
  socials: "Social links",
  image_grid: "Image grid",
  list: "List",
  divider: "Divider",
  big_link: "Featured link",
  internal_big_link: "Internal link",
  header_image: "Header image",
  audio: "Audio",
  file: "File",
  video: "Video",
  call_to_action: "CTA",
  visual_break: "Visual break",
  stat_band: "Stats",
};

/** User-facing label for notices and UI (not raw schema types). */
export function sectionTypeToFriendlyLabel(sectionType: string): string {
  const t = sectionType.toLowerCase();
  return TYPE_FRIENDLY[t] ?? (sectionType ? sectionType.replace(/_/g, " ") : "Section");
}

export function friendlyLabelsForSectionIds(
  schemaJson: string,
  sectionIds: string[],
): string[] {
  if (sectionIds.length === 0) return [];
  try {
    const doc = JSON.parse(schemaJson) as {
      pages?: Array<{ blocks?: Array<{ type?: string; content?: { aiSectionId?: string } }> }>;
    };
    const blocks = doc.pages?.[0]?.blocks ?? [];
    return sectionIds.map((id) => {
      const b = blocks.find((bl) => String(bl?.content?.aiSectionId || "").trim() === id);
      const typ = String(b?.type || "");
      return sectionTypeToFriendlyLabel(typ);
    });
  } catch {
    return [];
  }
}
