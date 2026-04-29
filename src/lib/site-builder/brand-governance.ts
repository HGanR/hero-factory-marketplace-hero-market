/**
 * Brand governance pass — align section visuals to metadata.designSystem without flattening layout.
 * Runs after Troothertz rhythm/continuity (see troothertz-visual-postprocess).
 */

import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { ensureDesignSystemOnDocument } from "@/lib/site-builder/design-system";

function isMidCtaBlock(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): boolean {
  if (String(block.type) !== "call_to_action") return false;
  const c = block.content as Record<string, unknown> | undefined;
  const rk = String(c?.aiRegistryKey || "");
  return rk === "mid_cta" || rk === "footer_cta";
}

export function applyBrandGovernanceToDocument(doc: SiteSchemaDocumentType): boolean {
  const ds = ensureDesignSystemOnDocument(doc);
  const accent = ds.colors.accent;
  const muted = ds.colors.textMuted;
  let touched = false;

  const proofCap = ds.density === "compact" ? 0.85 : 1;

  for (const page of doc.pages) {
    for (const block of page.blocks) {
      const raw = block.content;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const content = { ...(raw as Record<string, unknown>) };
      const vis =
        content.visual && typeof content.visual === "object" && !Array.isArray(content.visual)
          ? { ...(content.visual as Record<string, unknown>) }
          : {};

      const t = String(block.type);
      if (t === "hero" || t === "call_to_action" || t === "stat_band" || t === "visual_break") {
        if (String(vis.accent || "") !== accent) {
          vis.accent = accent;
          touched = true;
        }
        if (vis.ringAccent != null && String(vis.ringAccent) !== accent) {
          vis.ringAccent = accent;
          touched = true;
        }
      }

      if (t === "stat_band" && proofCap < 1 && typeof vis.statEmphasis === "number") {
        vis.statEmphasis = Math.min(vis.statEmphasis as number, proofCap);
        touched = true;
      }

      if (isMidCtaBlock(block)) {
        vis.ctaTone = vis.ctaTone ?? "primary";
        if (String(vis.labelWeight ?? "") !== "semibold") {
          vis.labelWeight = "semibold";
          touched = true;
        }
      }

      if (t === "text" || t === "paragraph") {
        const sd = vis.sectionDepth as Record<string, unknown> | undefined;
        if (sd && ds.density === "compact" && sd.paddingScale == null) {
          sd.paddingScale = 0.92;
          vis.sectionDepth = sd;
          touched = true;
        }
      }

      if (t === "hero" && ds.density === "spacious" && vis.sectionPadding == null) {
        vis.sectionPadding = "lg";
        touched = true;
      }

      content.visual = vis;
      (block as { content: unknown }).content = content;
    }
  }

  if (touched) {
    const base = doc.metadata ?? { title: "Site" };
    const gv = base.governance;
    doc.metadata = {
      ...base,
      governance: {
        ...(typeof gv === "object" && gv ? (gv as Record<string, unknown>) : {}),
        brandPassVersion: 1,
        lastAlignedAt: new Date().toISOString(),
      },
    };
  }

  return touched;
}
