/**
 * Single pipeline for TROOTHHERTZ visual metadata: rhythm → sectionDepth + continuity.
 * Used by AI generation, section regeneration, and schema assembly paths (e.g. MAANIA import).
 */

import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import {
  buildContinuityVisual,
  buildRhythmSequence,
  buildSectionDepthVisual,
  effectiveStyleModeFromPlanner,
  getEngineProfile,
  isRhythmDenseBlock,
  rhythmOverlayForSlot,
  TROOTHERTZ_SIGNATURE,
  type RhythmSlot,
  type SectionDepthKind,
  type StyleMode,
} from "@/lib/site-builder/ai/visual-tokens";
import { applyBrandGovernanceToDocument } from "@/lib/site-builder/brand-governance";
import { ensureDesignSystemOnDocument } from "@/lib/site-builder/design-system";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export function styleModeFromSiteDocument(doc: SiteSchemaDocumentType): StyleMode {
  return doc.metadata?.theme?.styleMode ?? "corporate";
}

export function sectionDepthKindFromBlock(
  block: SiteSchemaDocumentType["pages"][number]["blocks"][number],
): SectionDepthKind | null {
  const t = String(block.type);
  const c = (block.content && typeof block.content === "object" ? block.content : {}) as Record<string, unknown>;
  if (t === "list" && String(c.variant || "") === "trust_strip") return "trust_strip";
  if (t === "stat_band") return "stat_band";
  if (t === "image_grid") return "image_grid";
  if (t === "call_to_action") return "mid_cta";
  if (t === "visual_break") {
    return String(c.variant || "") === "glow_strip" ? "glow_strip" : "visual_break_gradient";
  }
  if (t === "text") return "proof_shallow";
  if (t === "paragraph" && String(c.aiRegistryKey || "") === "paragraph_intro") return "proof_shallow";
  return null;
}

function registryKeyFromBlock(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string | undefined {
  const c = block.content && typeof block.content === "object" ? (block.content as Record<string, unknown>) : undefined;
  const k = c?.aiRegistryKey;
  return typeof k === "string" && k.trim() ? k.trim() : undefined;
}

function listVariantFromBlock(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string | undefined {
  if (String(block.type) !== "list") return undefined;
  const c = block.content && typeof block.content === "object" ? (block.content as Record<string, unknown>) : undefined;
  const v = c?.variant;
  return typeof v === "string" ? v : undefined;
}

export function applyTroothertzVisualPostProcessToBlocks(
  blocks: SiteSchemaDocumentType["pages"][number]["blocks"],
  mode: StyleMode,
  planner?: SitePlannerOutput,
): void {
  applyTroothertzRhythm(blocks, mode, planner);
  applySectionDepthAndContinuity(blocks, mode);
}

export function applyTroothertzVisualPostProcessToDocument(doc: SiteSchemaDocumentType, styleMode?: StyleMode): SiteSchemaDocumentType {
  ensureDesignSystemOnDocument(doc);
  const mode = styleMode ?? styleModeFromSiteDocument(doc);
  for (const page of doc.pages) {
    applyTroothertzVisualPostProcessToBlocks(page.blocks, mode);
  }
  applyBrandGovernanceToDocument(doc);
  return doc;
}

/** When a planner is available (e.g. AI generation), prefer tokens from the planner. */
export function applyTroothertzVisualPostProcessFromPlanner(
  doc: SiteSchemaDocumentType,
  planner: SitePlannerOutput,
): SiteSchemaDocumentType {
  const mode = effectiveStyleModeFromPlanner(planner);
  ensureDesignSystemOnDocument(doc);
  for (const page of doc.pages) {
    applyTroothertzVisualPostProcessToBlocks(page.blocks, mode, planner);
  }
  applyBrandGovernanceToDocument(doc);
  return doc;
}

function applyTroothertzRhythm(
  blocks: SiteSchemaDocumentType["pages"][number]["blocks"],
  mode: StyleMode,
  planner?: SitePlannerOutput,
): void {
  let plan = buildRhythmSequence(blocks, mode);
  if (planner?.sectionPlan?.length) {
    plan = plan.map((p, i) => {
      const raw = blocks[i]?.content;
      const sid =
        raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as { aiSectionId?: string }).aiSectionId === "string"
          ? String((raw as { aiSectionId: string }).aiSectionId).trim()
          : "";
      const row = sid ? planner.sectionPlan.find((s) => s.id === sid) : undefined;
      const rs = row?.rhythmSurface;
      if (rs === "light" || rs === "dark" || rs === "visual") {
        const slot = (["light", "dark", "visual"] as const).indexOf(rs) as RhythmSlot;
        return { slot, sectionTone: rs };
      }
      return p;
    });
  }
  for (let i = 0; i < blocks.length; i++) {
    const { slot, sectionTone } = plan[i]!;
    const block = blocks[i]!;
    const raw = block.content;
    const content =
      raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
    content.visualEngine = {
      signature: TROOTHERTZ_SIGNATURE,
      rhythmSlot: slot,
      sectionTone,
    };
    const vis =
      content.visual && typeof content.visual === "object" && !Array.isArray(content.visual)
        ? { ...(content.visual as Record<string, unknown>) }
        : {};
    vis.rhythmOverlay = rhythmOverlayForSlot(slot, mode);
    content.visual = vis;
    (block as { content: unknown }).content = content;
  }
}

function applySectionDepthAndContinuity(blocks: SiteSchemaDocumentType["pages"][number]["blocks"], mode: StyleMode): void {
  const profile = getEngineProfile(mode);
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    const raw = block.content;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const content = { ...(raw as Record<string, unknown>) };
    const ve = content.visualEngine as { rhythmSlot?: number; sectionTone?: string } | undefined;
    const slot = (typeof ve?.rhythmSlot === "number" ? ve.rhythmSlot : i % 3) as RhythmSlot;
    const tone = (ve?.sectionTone || (["light", "dark", "visual"] as const)[slot % 3]) as "light" | "dark" | "visual";
    const prev = i > 0 ? blocks[i - 1]! : undefined;
    const next = i < blocks.length - 1 ? blocks[i + 1]! : undefined;
    const prevC = prev?.content && typeof prev.content === "object" ? (prev.content as Record<string, unknown>) : undefined;
    const nextC = next?.content && typeof next.content === "object" ? (next.content as Record<string, unknown>) : undefined;
    const prevVe = prevC?.visualEngine as { sectionTone?: string } | undefined;
    const nextVe = nextC?.visualEngine as { sectionTone?: string } | undefined;
    const prevTone = prevVe?.sectionTone as "light" | "dark" | "visual" | undefined;
    const nextTone = nextVe?.sectionTone as "light" | "dark" | "visual" | undefined;

    const vis =
      content.visual && typeof content.visual === "object" && !Array.isArray(content.visual)
        ? { ...(content.visual as Record<string, unknown>) }
        : {};

    const kind = sectionDepthKindFromBlock(block);
    const rk = registryKeyFromBlock(block);
    const listVar = listVariantFromBlock(block);
    const prevDense = prev ? isRhythmDenseBlock(String(prev.type)) : false;
    const nextDense = next ? isRhythmDenseBlock(String(next.type)) : false;
    const adjacentDense = prevDense || nextDense;
    if (kind) {
      vis.sectionDepth = buildSectionDepthVisual(kind, mode, profile, `sec:${i}:${slot}`, slot, {
        registryKey: rk,
        listVariant: listVar,
        adjacentDense: kind === "proof_shallow" ? adjacentDense : undefined,
      });
    }

    const variant = String((content as { variant?: string }).variant || "");
    const continuity = buildContinuityVisual(mode, {
      blockType: String(block.type),
      variant: variant || undefined,
      prevType: prev ? String(prev.type) : undefined,
      nextType: next ? String(next.type) : undefined,
      sectionTone: tone,
      prevTone,
      nextTone,
      rhythmSlot: slot,
      prevRegistryKey: prev ? registryKeyFromBlock(prev) : undefined,
      nextRegistryKey: next ? registryKeyFromBlock(next) : undefined,
    });
    if (continuity) {
      vis.continuity = continuity;
    }

    content.visual = vis;
    (block as { content: unknown }).content = content;
  }
}
