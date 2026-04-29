/**
 * Safe, deterministic Brand Brain autofixes — light visual metadata only (no structural edits).
 * Heavy alignment still runs via applyTroothertzVisualPostProcessToDocument + applyBrandGovernanceToDocument.
 */

import { styleModeFromSiteDocument } from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import { rhythmOverlayForSlot, type RhythmSlot, type StyleMode } from "@/lib/site-builder/ai/visual-tokens";
import type { BrandBrainDecisionMode } from "@/lib/site-builder/brand-brain-schema";
import type { BrandBrainEvaluation } from "@/lib/site-builder/brand-brain-evaluate";
import { ensureDesignSystemOnDocument } from "@/lib/site-builder/design-system";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

type BlockT = SiteSchemaDocumentType["pages"][number]["blocks"][number];

function blockContent(block: BlockT): Record<string, unknown> {
  const raw = block.content;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function setContent(block: BlockT, content: Record<string, unknown>): void {
  (block as { content: unknown }).content = content;
}

function visualMutable(block: BlockT): Record<string, unknown> {
  const c = { ...blockContent(block) };
  const v = c.visual;
  const vis = v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
  return vis;
}

function commitVisual(block: BlockT, c: Record<string, unknown>, vis: Record<string, unknown>): void {
  c.visual = vis;
  setContent(block, c);
}

function normHex(s: string): string {
  return s.trim().toLowerCase();
}

function isProofHeavy(block: BlockT): boolean {
  const t = String(block.type);
  if (t === "stat_band") return true;
  if (t === "image_grid") return true;
  if (t === "list") {
    const v = String(blockContent(block).variant || "");
    return v === "trust_strip";
  }
  return false;
}

function engineTone(block: BlockT): string {
  const c = blockContent(block);
  const ve = c.visualEngine as { sectionTone?: string } | undefined;
  return String(ve?.sectionTone || "").trim() || "light";
}

function findingCodes(evaluation: BrandBrainEvaluation): Set<string> {
  return new Set(evaluation.findings.map((f) => f.code));
}

export function applyBrandBrainAutofixes(
  doc: SiteSchemaDocumentType,
  evaluation: BrandBrainEvaluation,
  mode: BrandBrainDecisionMode,
): { touched: boolean; appliedCodes: string[] } {
  if (mode === "suggest_only") {
    return { touched: false, appliedCodes: [] };
  }

  const codes = findingCodes(evaluation);
  const appliedCodes: string[] = [];
  let touched = false;
  const ds = ensureDesignSystemOnDocument(doc);
  const tokenAccent = ds.colors.accent;
  const styleMode = styleModeFromSiteDocument(doc);

  const allowAccentStreak = mode === "safe_auto_apply";

  const mark = (code: string) => {
    appliedCodes.push(code);
    touched = true;
  };

  if (codes.has("visual_accent_token_drift")) {
    if (fixTokenAccentDrift(doc, tokenAccent)) mark("visual_accent_token_drift");
  }

  if (codes.has("hero_cta_accent_mismatch")) {
    if (fixHeroCtaAccentMismatch(doc)) mark("hero_cta_accent_mismatch");
  }

  if (codes.has("cta_tone_inconsistent")) {
    if (fixCtaTones(doc)) mark("cta_tone_inconsistent");
  }

  if (codes.has("proof_overload_mid")) {
    if (fixProofOverload(doc)) mark("proof_overload_mid");
  }

  if (codes.has("spacing_padding_imbalance")) {
    if (fixSpacingPadding(doc)) mark("spacing_padding_imbalance");
  }

  if (allowAccentStreak && codes.has("accent_streak_heavy")) {
    if (fixAccentStreak(doc, styleMode)) mark("accent_streak_heavy");
  }

  return { touched, appliedCodes };
}

function fixCtaTones(doc: SiteSchemaDocumentType): boolean {
  let touched = false;
  for (const page of doc.pages) {
    for (const block of page.blocks) {
      const t = String(block.type);
      if (t !== "call_to_action" && t !== "hero") continue;
      const c = { ...blockContent(block) };
      const vis = visualMutable(block);
      const cur = String(vis.ctaTone || "primary").trim() || "primary";
      if (cur !== "primary") {
        vis.ctaTone = "primary";
        commitVisual(block, c, vis);
        touched = true;
      }
    }
  }
  return touched;
}

function fixTokenAccentDrift(doc: SiteSchemaDocumentType, accent: string): boolean {
  let touched = false;
  const target = normHex(accent);
  for (const page of doc.pages) {
    for (const block of page.blocks) {
      const t = String(block.type);
      if (t !== "hero" && t !== "call_to_action" && t !== "stat_band" && t !== "visual_break") continue;
      const c = { ...blockContent(block) };
      const vis = visualMutable(block);
      const cur = normHex(String(vis.accent || ""));
      if (cur && cur !== target) {
        vis.accent = accent;
        if (vis.ringAccent != null) vis.ringAccent = accent;
        commitVisual(block, c, vis);
        touched = true;
      }
    }
  }
  return touched;
}

function fixHeroCtaAccentMismatch(doc: SiteSchemaDocumentType): boolean {
  let touched = false;
  for (const page of doc.pages) {
    const blocks = page.blocks;
    const heroIdx = blocks.findIndex((b) => String(b.type) === "hero");
    if (heroIdx === -1) continue;
    const hero = blocks[heroIdx]!;
    const hc = { ...blockContent(hero) };
    const hvis = visualMutable(hero);
    const ha = normHex(String(hvis.accent || ""));
    if (!ha) continue;

    for (const block of blocks) {
      if (String(block.type) !== "call_to_action") continue;
      const c = { ...blockContent(block) };
      const vis = visualMutable(block);
      const ca = normHex(String(vis.accent || ""));
      if (ca && ca !== ha) {
        vis.accent = String(hvis.accent || "");
        if (vis.ringAccent != null) vis.ringAccent = vis.accent;
        commitVisual(block, c, vis);
        touched = true;
      }
    }
  }
  return touched;
}

function fixProofOverload(doc: SiteSchemaDocumentType): boolean {
  let touched = false;
  for (const page of doc.pages) {
    const blocks = page.blocks;
    const n = blocks.length;
    for (let i = 0; i <= n - 3; i++) {
      const slice = blocks.slice(i, i + 3);
      if (slice.filter(isProofHeavy).length < 3) continue;
      for (const block of slice) {
        if (String(block.type) !== "stat_band") continue;
        const c = { ...blockContent(block) };
        const vis = visualMutable(block);
        const em = typeof vis.statEmphasis === "number" ? vis.statEmphasis : 1;
        const next = Math.min(0.92, em * 0.82);
        if (next < em - 0.02) {
          vis.statEmphasis = next;
          commitVisual(block, c, vis);
          touched = true;
        }
      }
      break;
    }
  }
  return touched;
}

function fixSpacingPadding(doc: SiteSchemaDocumentType): boolean {
  let touched = false;
  for (const page of doc.pages) {
    const blocks = page.blocks;
    const scales: { block: BlockT; val: number }[] = [];
    for (const block of blocks) {
      const t = String(block.type);
      if (t !== "text" && t !== "paragraph") continue;
      const vis = visualMutable(block);
      const sdRaw = vis.sectionDepth;
      if (!sdRaw || typeof sdRaw !== "object" || Array.isArray(sdRaw)) continue;
      const sd = { ...(sdRaw as Record<string, unknown>) };
      const ps = sd.paddingScale;
      if (typeof ps === "number" && Number.isFinite(ps)) scales.push({ block, val: ps });
    }
    if (scales.length < 3) continue;
    const vals = scales.map((s) => s.val).sort((a, b) => a - b);
    const median = vals[Math.floor(vals.length / 2)]!;
    for (const { block, val } of scales) {
      if (Math.abs(val - median) <= 0.2) continue;
      const c = { ...blockContent(block) };
      const vis = visualMutable(block);
      const sdRaw = vis.sectionDepth;
      if (!sdRaw || typeof sdRaw !== "object" || Array.isArray(sdRaw)) continue;
      const sd = { ...(sdRaw as Record<string, unknown>) };
      const next = val + (median - val) * 0.55;
      sd.paddingScale = Math.round(next * 1000) / 1000;
      vis.sectionDepth = sd;
      commitVisual(block, c, vis);
      touched = true;
    }
  }
  return touched;
}

function fixAccentStreak(doc: SiteSchemaDocumentType, mode: StyleMode): boolean {
  let touched = false;
  for (const page of doc.pages) {
    const blocks = page.blocks;
    const n = blocks.length;
    let streak = 0;
    let start = 0;
    for (let i = 0; i < n; i++) {
      if (engineTone(blocks[i]!) === "visual") {
        if (streak === 0) start = i;
        streak += 1;
        if (streak >= 3) {
          const mid = start + 1;
          const block = blocks[mid]!;
          const c = { ...blockContent(block) };
          const vis = visualMutable(block);
          const soft = rhythmOverlayForSlot(0 as RhythmSlot, mode);
          if (String(vis.rhythmOverlay || "") !== soft) {
            vis.rhythmOverlay = soft;
            commitVisual(block, c, vis);
            touched = true;
          }
          break;
        }
      } else {
        streak = 0;
      }
    }
  }
  return touched;
}

/** Client or server: apply a single known fix by finding code (safe tier only). */
export function applyBrandBrainFixByCode(doc: SiteSchemaDocumentType, code: string): boolean {
  const ds = ensureDesignSystemOnDocument(doc);
  const accent = ds.colors.accent;
  const mode = styleModeFromSiteDocument(doc);
  switch (code) {
    case "cta_tone_inconsistent":
      return fixCtaTones(doc);
    case "visual_accent_token_drift":
      return fixTokenAccentDrift(doc, accent);
    case "hero_cta_accent_mismatch":
      return fixHeroCtaAccentMismatch(doc);
    case "proof_overload_mid":
      return fixProofOverload(doc);
    case "spacing_padding_imbalance":
      return fixSpacingPadding(doc);
    case "accent_streak_heavy":
      return fixAccentStreak(doc, mode);
    default:
      return false;
  }
}
