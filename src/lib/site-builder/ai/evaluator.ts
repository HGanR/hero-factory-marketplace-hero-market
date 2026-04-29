import { SITE_BUILDER_BLOCK_TYPES } from "@/lib/site-builder/ai/block-registry";
import type { SiteEvaluationReport } from "@/lib/site-builder/ai/schemas";
import { SiteEvaluationReportSchema } from "@/lib/site-builder/ai/schemas";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function pushFinding(
  findings: SiteEvaluationReport["findings"],
  partial: Omit<SiteEvaluationReport["findings"][number], "id"> & { id?: string }
) {
  findings.push({
    id: partial.id ?? `f_${findings.length + 1}`,
    severity: partial.severity,
    category: partial.category,
    message: partial.message,
    blockIndex: partial.blockIndex,
  });
}

export function evaluateSiteSchema(schema: SiteSchemaDocumentType): SiteEvaluationReport {
  const findings: SiteEvaluationReport["findings"] = [];
  let score = 100;

  const pages = schema.pages || [];
  if (pages.length === 0) {
    pushFinding(findings, {
      severity: "error",
      category: "dependencies",
      message: "No pages defined.",
    });
    score -= 40;
  }

  const customCss = String(schema.metadata?.advanced?.customCss || "");
  if (/\bposition\s*:\s*fixed\b/i.test(customCss) && /\bwidth\s*:\s*\d+px\b/i.test(customCss)) {
    pushFinding(findings, {
      severity: "warn",
      category: "responsive",
      message: "Custom CSS uses fixed positioning with pixel widths — verify behavior on small viewports.",
    });
    score -= 5;
  }
  if (/\bmin-width\s*:\s*[5-9]\d{2,}px\b/i.test(customCss)) {
    pushFinding(findings, {
      severity: "warn",
      category: "responsive",
      message: "Custom CSS includes large min-width values that may cause horizontal overflow on mobile.",
    });
    score -= 8;
  }

  const metaTitle = String(schema.metadata?.title || "").trim();
  if (!metaTitle) {
    pushFinding(findings, {
      severity: "warn",
      category: "content",
      message: "metadata.title is empty — set a concise page title for SEO and accessibility context.",
    });
    score -= 6;
  }

  let hasHeroHeading = false;
  pages.forEach((page, pageIdx) => {
    const blocks = page.blocks || [];
    blocks.forEach((block, blockIndex) => {
      const type = String(block?.type || "");
      if (!SITE_BUILDER_BLOCK_TYPES.has(type)) {
        pushFinding(findings, {
          severity: "error",
          category: "dependencies",
          message: `Unknown block type "${type}" — not in supported site-builder block set.`,
          blockIndex,
        });
        score -= 12;
      }

      if (type === "hero") {
        const title = String(block?.content?.title || "").trim();
        if (title) hasHeroHeading = true;
        else {
          pushFinding(findings, {
            severity: "warn",
            category: "accessibility",
            message: "Hero block has empty title — screen readers lose primary page context.",
            blockIndex,
          });
          score -= 5;
        }
      }

      if (type === "image" || type === "header_image") {
        const alt = String(block?.content?.alt || "").trim();
        const src = String(block?.src || "").trim();
        if (src && !alt) {
          pushFinding(findings, {
            severity: "warn",
            category: "accessibility",
            message: "Image block has src but empty alt text.",
            blockIndex,
          });
          score -= 4;
        }
      }

      if (type === "link" || type === "big_link" || type === "internal_big_link") {
        const label = String(block?.content?.label || "").trim();
        if (!label) {
          pushFinding(findings, {
            severity: "warn",
            category: "accessibility",
            message: "Link block has empty label — add descriptive text.",
            blockIndex,
          });
          score -= 4;
        }
      }

      if (type === "video" || type === "audio") {
        const src = String(block?.src || block?.content?.src || "").trim();
        if (!src) {
          pushFinding(findings, {
            severity: "info",
            category: "performance",
            message: `${type} block has no media src — preview will be empty (expected for placeholders).`,
            blockIndex,
          });
        }
      }
    });
    if (pageIdx === 0 && blocks.length > 40) {
      pushFinding(findings, {
        severity: "warn",
        category: "performance",
        message: "Home page has many blocks — consider splitting across routes for load and editing ergonomics.",
      });
      score -= 5;
    }
  });

  if (!hasHeroHeading) {
    const hasHeading = pages.some((p) => p.blocks?.some((b) => b.type === "heading" || b.type === "hero"));
    if (!hasHeading) {
      pushFinding(findings, {
        severity: "warn",
        category: "accessibility",
        message: "No hero title or heading block found — add a clear h1-level title for document outline.",
      });
      score -= 6;
    }
  }

  const theme = schema.metadata?.theme;
  if (theme?.backgroundMode === "custom_media" && !(schema.metadata?.theme?.mediaUrl || "").trim()) {
    pushFinding(findings, {
      severity: "warn",
      category: "design_coherence",
      message: "Theme backgroundMode is custom_media but mediaUrl is missing.",
    });
    score -= 4;
  }

  score = Math.max(0, Math.min(100, score));
  const passed = score >= 70 && !findings.some((f) => f.severity === "error");

  return SiteEvaluationReportSchema.parse({
    version: 1,
    score,
    passed,
    findings,
    dependencyAllowlist: Array.from(SITE_BUILDER_BLOCK_TYPES).sort(),
  });
}
