/**
 * Deterministic Brand Brain evaluation — schema + metadata only (no screenshots).
 */

import type { BrandBrainFinding, BrandBrainScorecard } from "@/lib/site-builder/brand-brain-schema";
import { ensureDesignSystemOnDocument } from "@/lib/site-builder/design-system";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export type BrandBrainEvaluation = {
  findings: BrandBrainFinding[];
  scorecard: BrandBrainScorecard;
};

function normHex(s: string): string {
  return s.trim().toLowerCase();
}

function blockContent(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): Record<string, unknown> {
  const raw = block.content;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function sectionIdOf(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  return String(blockContent(block).aiSectionId || "").trim();
}

function visualOf(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): Record<string, unknown> {
  const c = blockContent(block);
  const v = c.visual;
  if (v && typeof v === "object" && !Array.isArray(v)) return { ...(v as Record<string, unknown>) };
  return {};
}

function engineTone(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const c = blockContent(block);
  const ve = c.visualEngine as { sectionTone?: string } | undefined;
  return String(ve?.sectionTone || "").trim() || "light";
}

function isProofHeavy(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): boolean {
  const t = String(block.type);
  if (t === "stat_band") return true;
  if (t === "image_grid") return true;
  if (t === "list") {
    const v = String(blockContent(block).variant || "");
    return v === "trust_strip";
  }
  return false;
}

function ctaToneOf(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const t = String(block.type);
  if (t !== "call_to_action" && t !== "hero") return "";
  const vis = visualOf(block);
  return String(vis.ctaTone || "primary").trim() || "primary";
}

function heroAccent(block: SiteSchemaDocumentType["pages"][number]["blocks"][number]): string {
  const vis = visualOf(block);
  return normHex(String(vis.accent || ""));
}

export function evaluateBrandBrain(doc: SiteSchemaDocumentType): BrandBrainEvaluation {
  const findings: BrandBrainFinding[] = [];
  const ds = ensureDesignSystemOnDocument(doc);
  const tokenAccent = normHex(ds.colors.accent);

  const ctaTones: string[] = [];
  const accentsOffToken: Array<{ route: string; sectionId: string }> = [];

  for (const page of doc.pages) {
    for (const block of page.blocks) {
      const sid = sectionIdOf(block);
      const ct = ctaToneOf(block);
      if (ct) ctaTones.push(ct);

      const t = String(block.type);
      if (t === "hero" || t === "call_to_action" || t === "stat_band" || t === "visual_break") {
        const a = normHex(String(visualOf(block).accent || ""));
        if (a && tokenAccent && a !== tokenAccent) {
          accentsOffToken.push({ route: page.slug, sectionId: sid });
        }
      }
    }
  }

  const distinctCtaTones = [...new Set(ctaTones)].sort();
  if (distinctCtaTones.length > 1) {
    findings.push({
      code: "cta_tone_inconsistent",
      severity: "warn",
      scope: "site",
      recommendation: "CTA emphasis styles differ across the site — harmonize ctaTone for a single conversion story.",
    });
  }

  if (accentsOffToken.length > 0) {
    const first = accentsOffToken[0]!;
    findings.push({
      code: "visual_accent_token_drift",
      severity: "warn",
      scope: first.sectionId ? "section" : "site",
      route: first.route,
      sectionId: first.sectionId || undefined,
      recommendation: "Section accents diverge from design-system tokens where alignment is expected.",
    });
  }

  for (const page of doc.pages) {
    const blocks = page.blocks;
    const n = blocks.length;
    if (n >= 3) {
      for (let i = 0; i <= n - 3; i++) {
        const slice = blocks.slice(i, i + 3);
        const proofCount = slice.filter(isProofHeavy).length;
        if (proofCount >= 3) {
          findings.push({
            code: "proof_overload_mid",
            severity: "warn",
            scope: "route",
            route: page.slug,
            sectionId: sectionIdOf(slice[1]!) || undefined,
            recommendation: "Proof-heavy sections cluster — consider spacing or softening emphasis in the middle of this run.",
          });
          break;
        }
      }
    }

    if (page.slug === "/" && n >= 8) {
      const proofTotal = blocks.filter(isProofHeavy).length;
      if (proofTotal === 0) {
        findings.push({
          code: "proof_underuse_home",
          severity: "info",
          scope: "route",
          route: page.slug,
          recommendation: "Home is long but light on explicit proof — a single metrics or trust strip may help credibility.",
        });
      }
    }

    const scales: number[] = [];
    for (const block of blocks) {
      const t = String(block.type);
      if (t !== "text" && t !== "paragraph") continue;
      const vis = visualOf(block);
      const sd = vis.sectionDepth as Record<string, unknown> | undefined;
      const ps = sd?.paddingScale;
      if (typeof ps === "number" && Number.isFinite(ps)) scales.push(ps);
    }
    if (scales.length >= 3) {
      const min = Math.min(...scales);
      const max = Math.max(...scales);
      if (max - min > 0.34) {
        findings.push({
          code: "spacing_padding_imbalance",
          severity: "info",
          scope: "route",
          route: page.slug,
          recommendation: "Vertical rhythm between text sections is uneven — normalize padding scale slightly.",
        });
      }
    }

    if (n >= 5) {
      const visualish = blocks.filter((b) => engineTone(b) === "visual").length;
      if (visualish / n > 0.55) {
        findings.push({
          code: "visual_density_high",
          severity: "info",
          scope: "route",
          route: page.slug,
          recommendation: "This page skews visually heavy — a calmer band would match a more minimal direction.",
        });
      }
    }

    let streak = 0;
    let streakStart = 0;
    for (let i = 0; i < n; i++) {
      const tone = engineTone(blocks[i]!);
      if (tone === "visual") {
        if (streak === 0) streakStart = i;
        streak += 1;
        if (streak >= 3) {
          findings.push({
            code: "accent_streak_heavy",
            severity: "info",
            scope: "route",
            route: page.slug,
            sectionId: sectionIdOf(blocks[streakStart + 1]!) || undefined,
            recommendation: "Several accent-forward sections run back-to-back — soften one band to restore rhythm.",
          });
          break;
        }
      } else {
        streak = 0;
      }
    }

    const heroIdx = blocks.findIndex((b) => String(b.type) === "hero");
    if (heroIdx !== -1 && n >= 4) {
      const ha = heroAccent(blocks[heroIdx]!);
      const ctas = blocks
        .map((b, i) => ({ b, i }))
        .filter((x) => String(x.b.type) === "call_to_action" && ha && heroAccent(x.b) && heroAccent(x.b) !== ha);
      if (ctas.length > 0) {
        const cta = ctas[0]!;
        findings.push({
          code: "hero_cta_accent_mismatch",
          severity: "warn",
          scope: "section",
          route: page.slug,
          sectionId: sectionIdOf(cta.b) || undefined,
          recommendation: "Hero and mid-page CTA accents diverge — align to one accent thread.",
        });
      }
      const tail = Math.max(1, Math.ceil(n * 0.4));
      const tailBlocks = blocks.slice(n - tail);
      const hasTailCta = tailBlocks.some((b) => String(b.type) === "call_to_action");
      if (!hasTailCta && !tailBlocks.some((b) => String(b.type) === "footer")) {
        findings.push({
          code: "narrative_weak_cta_placement",
          severity: "info",
          scope: "route",
          route: page.slug,
          recommendation: "The page story tapers without a late invitation — consider a closing CTA or footer emphasis.",
        });
      }
    }

    const metaBg = doc.metadata?.theme?.backgroundMode;
    const customMediaBlocks = blocks.filter((b) => {
      const c = blockContent(b);
      return typeof c.mediaUrl === "string" && c.mediaUrl.length > 4;
    }).length;
    if (metaBg === "simple_gradients" && customMediaBlocks >= 3) {
      findings.push({
        code: "theme_media_drift",
        severity: "info",
        scope: "route",
        route: page.slug,
        recommendation: "Theme suggests simple gradients while several sections carry custom media — align background strategy.",
      });
    }
  }

  if (doc.pages.length >= 2) {
    const lengths = doc.pages.map((p) => p.blocks.length);
    const spread = Math.max(...lengths) - Math.min(...lengths);
    if (spread >= 5) {
      findings.push({
        code: "route_family_inconsistent",
        severity: "info",
        scope: "site",
        recommendation: "Routes differ strongly in length — consider parallel narrative depth across key pages.",
      });
    }
  }

  findings.sort((a, b) => {
    const s = (x: BrandBrainFinding) => (x.severity === "warn" ? 0 : 1);
    const d = s(a) - s(b);
    if (d !== 0) return d;
    return a.code.localeCompare(b.code);
  });

  const consistencyCodes = new Set([
    "cta_tone_inconsistent",
    "visual_accent_token_drift",
    "hero_cta_accent_mismatch",
    "route_family_inconsistent",
    "theme_media_drift",
  ]);
  const narrativeCodes = new Set(["narrative_weak_cta_placement", "route_family_inconsistent"]);
  const proofCodes = new Set(["proof_overload_mid", "proof_underuse_home"]);
  const rhythmCodes = new Set([
    "spacing_padding_imbalance",
    "visual_density_high",
    "accent_streak_heavy",
    "theme_media_drift",
  ]);

  const subScore = (codes: Set<string>, w: number, i: number) => {
    let v = 100;
    for (const f of findings) {
      if (!codes.has(f.code)) continue;
      v -= f.severity === "warn" ? w : i;
    }
    return Math.max(0, Math.min(100, v));
  };

  const scorecard: BrandBrainScorecard = {
    consistency: subScore(consistencyCodes, 12, 4),
    narrative: subScore(narrativeCodes, 10, 4),
    proofBalance: subScore(proofCodes, 14, 5),
    visualRhythm: subScore(rhythmCodes, 10, 4),
  };

  if (findings.length === 0) {
    scorecard.consistency = 100;
    scorecard.narrative = 100;
    scorecard.proofBalance = 100;
    scorecard.visualRhythm = 100;
  }

  return { findings, scorecard };
}
