/**
 * Applies `metadata.designSystem.lock` to every generated block so spacing, type scale, and CTAs
 * stay on-token regardless of registry defaults.
 */

import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import type { DesignSystem } from "@/lib/site-builder/design-system-schema";
import { ensureDesignSystemOnDocument } from "@/lib/site-builder/design-system";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function paddingFromRow(
  row: SitePlannerOutput["sectionPlan"][number] | undefined,
  lock: NonNullable<DesignSystem["lock"]>,
): number {
  const sp = row?.spacingScale;
  if (sp === "tight") return lock.sectionPaddingPx.tight;
  if (sp === "spacious") return lock.sectionPaddingPx.spacious;
  return lock.sectionPaddingPx.balanced;
}

export function applyDesignSystemLockToDocument(doc: SiteSchemaDocumentType, planner: SitePlannerOutput): void {
  const ds = ensureDesignSystemOnDocument(doc);
  const lock = ds.lock;
  if (!lock) return;
  for (const page of doc.pages) {
    for (const block of page.blocks) {
      const raw = block.content;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const content = { ...(raw as Record<string, unknown>) };
      const sid = typeof content.aiSectionId === "string" ? content.aiSectionId.trim() : "";
      const row = sid ? planner.sectionPlan.find((s) => s.id === sid) : undefined;
      const pad = sid ? paddingFromRow(row, lock) : lock.sectionPaddingPx.balanced;
      const style =
        content.style && typeof content.style === "object" && !Array.isArray(content.style)
          ? { ...(content.style as Record<string, unknown>) }
          : {};
      style.padding = pad;
      const t = String(block.type);
      if (t === "paragraph" || t === "text") {
        style.fontSize = `${lock.typographyRem.body}rem`;
        style.lineHeight = 1.55;
      }
      if (t === "section") {
        style.fontSize = `${lock.typographyRem.lead}rem`;
      }
      if (t === "call_to_action" || t === "button") {
        style.borderRadius = lock.cta.borderRadius;
        style.fontWeight = lock.cta.fontWeight;
        style.paddingTop = lock.cta.paddingY;
        style.paddingBottom = lock.cta.paddingY;
        style.paddingLeft = lock.cta.paddingX;
        style.paddingRight = lock.cta.paddingX;
        if (lock.cta.boxShadow) style.boxShadow = lock.cta.boxShadow;
      }
      content.style = style;
      (block as { content: unknown }).content = content;
    }
  }
}
