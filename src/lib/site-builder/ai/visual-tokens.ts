/**
 * TROOTHHERTZ Signature Visual Engine — shared visual + motion for AI-generated blocks.
 * Maps styleMode → engine profile (full / reduced / stripped / intense) and layer hints.
 */

import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";

export type StyleMode = "web3" | "corporate" | "minimal" | "bold";

/** Maps product tone to rendering intensity (no UI exposure). */
export type EngineProfile = "full" | "reduced" | "stripped" | "intense";

export const TROOTHERTZ_SIGNATURE = "troothertz-sve-v1";

const PALETTES: Record<
  StyleMode,
  { accent: string; surface: string; glow: string; gradient: string; muted: string }
> = {
  web3: {
    accent: "#22d3ee",
    surface: "rgba(15, 23, 42, 0.85)",
    glow: "rgba(99, 102, 241, 0.45)",
    gradient: "linear-gradient(135deg, rgba(49, 46, 129, 0.9) 0%, rgba(76, 29, 149, 0.75) 50%, rgba(15, 23, 42, 0.95) 100%)",
    muted: "#94a3b8",
  },
  corporate: {
    accent: "#38bdf8",
    surface: "rgba(15, 23, 42, 0.92)",
    glow: "rgba(56, 189, 248, 0.2)",
    gradient:
      "linear-gradient(155deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.9) 52%, rgba(15, 23, 42, 0.97) 100%)",
    muted: "#cbd5e1",
  },
  minimal: {
    accent: "#e2e8f0",
    surface: "rgba(15, 23, 42, 0.75)",
    glow: "rgba(148, 163, 184, 0.1)",
    gradient: "linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.86) 100%)",
    muted: "#94a3b8",
  },
  bold: {
    accent: "#f472b6",
    surface: "rgba(30, 27, 75, 0.9)",
    glow: "rgba(244, 114, 182, 0.42)",
    gradient:
      "linear-gradient(118deg, rgba(88, 28, 135, 0.98) 0%, rgba(190, 24, 93, 0.62) 38%, rgba(15, 23, 42, 0.99) 100%)",
    muted: "#fce7f3",
  },
};

const PROFILE_SCALE: Record<
  EngineProfile,
  { noiseMul: number; gridMul: number; glowMul: number; animateBackground: boolean }
> = {
  full: { noiseMul: 1, gridMul: 1, glowMul: 1, animateBackground: true },
  reduced: { noiseMul: 0.45, gridMul: 0.4, glowMul: 0.62, animateBackground: false },
  stripped: { noiseMul: 0.12, gridMul: 0.15, glowMul: 0.32, animateBackground: false },
  intense: { noiseMul: 1.35, gridMul: 1.15, glowMul: 1.28, animateBackground: true },
};

export function resolveStyleMode(input: {
  designDirection?: string;
  web3VisualMode?: boolean;
  intent?: string;
}): StyleMode {
  if (input.web3VisualMode || input.intent === "web3_product") return "web3";
  const d = input.designDirection || "operator";
  if (d === "minimal") return "minimal";
  if (d === "bold" || d === "cyber") return "bold";
  if (d === "luxe") return "corporate";
  return "corporate";
}

export function getPalette(mode: StyleMode) {
  return PALETTES[mode];
}

export function getEngineProfile(mode: StyleMode): EngineProfile {
  switch (mode) {
    case "web3":
      return "full";
    case "corporate":
      return "reduced";
    case "minimal":
      return "stripped";
    case "bold":
      return "intense";
  }
}

export type RhythmSlot = 0 | 1 | 2;

export function rhythmSectionTone(slot: RhythmSlot): "light" | "dark" | "visual" {
  return (["light", "dark", "visual"] as const)[slot];
}

/** Layer hints for preview + static HTML (CSS string fragments). */
export function buildSectionVisualLayers(
  mode: StyleMode,
  seed: string,
  profile: EngineProfile = getEngineProfile(mode),
): {
  gradient: string;
  glowShadow: string;
  noiseOpacity: number;
  gridOpacity: number;
  animateBackground: boolean;
  ambientGlow?: string;
} {
  const p = PALETTES[mode];
  const n = seed.length % 7;
  const scale = PROFILE_SCALE[profile];
  const baseNoise = mode === "minimal" ? 0.028 : 0.038;
  const baseGrid = mode === "minimal" ? 0.045 : 0.072;
  const glowPx = Math.round((48 + n * 4) * scale.glowMul);
  return {
    gradient: p.gradient,
    glowShadow: `0 0 ${glowPx}px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
    noiseOpacity: Math.min(0.09, baseNoise * scale.noiseMul),
    gridOpacity: Math.min(0.12, baseGrid * scale.gridMul),
    animateBackground: scale.animateBackground && profile !== "stripped",
    ambientGlow:
      profile === "stripped"
        ? undefined
        : `radial-gradient(ellipse 80% 50% at 50% -10%, ${p.glow} 0%, transparent 60%)`,
  };
}

/** Alternate section surface treatment (light / dark / accent wash). */
export function rhythmOverlayForSlot(slot: RhythmSlot, mode: StyleMode): string {
  const p = PALETTES[mode];
  if (slot === 0) return "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 45%)";
  if (slot === 1) return "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 50%)";
  return `linear-gradient(100deg, transparent 0%, ${p.accent}14 45%, transparent 90%)`;
}

export function defaultMotionForMode(mode: StyleMode, profile: EngineProfile = getEngineProfile(mode)): {
  entrance: "fadeUp" | "fade";
  stagger: number;
  hover: "lift" | "glow" | "none";
  backgroundPulse?: boolean;
} {
  if (profile === "stripped" || mode === "minimal") {
    return { entrance: "fade", stagger: 0.04, hover: "none", backgroundPulse: false };
  }
  if (profile === "intense" || mode === "bold") {
    return { entrance: "fadeUp", stagger: 0.1, hover: "glow", backgroundPulse: true };
  }
  if (profile === "reduced" || mode === "corporate") {
    return { entrance: "fadeUp", stagger: 0.055, hover: "lift", backgroundPulse: false };
  }
  return { entrance: "fadeUp", stagger: 0.085, hover: "glow", backgroundPulse: true };
}

/** Framer Motion + static CSS share these timing curves (premium, not flashy). */
export const THZ_EASE_OUT = [0.22, 1, 0.36, 1] as const;

export const THZ_MOTION = {
  ease: THZ_EASE_OUT,
  section: { duration: 0.48, y: 16 },
  entrance: { duration: 0.42, yOffset: 12 },
  micro: { duration: 0.34, yOffset: 8 },
  staggerBlock: 0.052,
} as const;

export function motionForEngineProfile(profile: EngineProfile): typeof THZ_MOTION & { section: { duration: number; y: number } } {
  if (profile === "stripped") {
    return {
      ...THZ_MOTION,
      section: { duration: 0.34, y: 10 },
      entrance: { duration: 0.3, yOffset: 6 },
      micro: { duration: 0.28, yOffset: 4 },
    };
  }
  if (profile === "intense") {
    return {
      ...THZ_MOTION,
      section: { duration: 0.52, y: 20 },
      entrance: { duration: 0.46, yOffset: 14 },
      micro: { duration: 0.38, yOffset: 10 },
    };
  }
  if (profile === "reduced") {
    return {
      ...THZ_MOTION,
      section: { duration: 0.44, y: 12 },
      entrance: { duration: 0.38, yOffset: 9 },
    };
  }
  return THZ_MOTION;
}

/** Blocks that stack heavy glow / mesh — used to avoid back-to-back “visual” intensity. */
export function isRhythmDenseBlock(blockType: string): boolean {
  return (
    blockType === "hero" ||
    blockType === "stat_band" ||
    blockType === "visual_break" ||
    blockType === "image_grid"
  );
}

/**
 * Per-section rhythm: alternates light / dark / accent wash, and breaks up dense glowing sections.
 */
export function buildRhythmSequence(
  blocks: Array<{ type?: string }>,
  mode: StyleMode,
): Array<{ slot: RhythmSlot; sectionTone: ReturnType<typeof rhythmSectionTone> }> {
  const profile = getEngineProfile(mode);
  let seq = 0;
  let lastDense = false;
  const out: Array<{ slot: RhythmSlot; sectionTone: ReturnType<typeof rhythmSectionTone> }> = [];
  for (let i = 0; i < blocks.length; i++) {
    const dense = isRhythmDenseBlock(String(blocks[i]?.type || ""));
    let slot = (seq % 3) as RhythmSlot;
    seq += 1;
    if (lastDense && dense && slot === 2) {
      slot = 0;
    }
    if (profile === "stripped" && slot === 2) {
      slot = 1;
    }
    lastDense = dense;
    out.push({ slot, sectionTone: rhythmSectionTone(slot) });
  }
  return out;
}

/** When `designTokens.styleMode` is missing (e.g. older LLM output), infer safely. */
export function effectiveStyleModeFromPlanner(planner: SitePlannerOutput): StyleMode {
  const explicit = planner.designTokens.styleMode;
  if (explicit) return explicit;
  const mi = planner.designTokens.motionIntensity;
  if (typeof mi === "number") {
    if (mi >= 78) return "bold";
    if (mi <= 22) return "minimal";
  }
  return resolveStyleMode({
    intent: planner.intent,
    web3VisualMode: planner.intent === "web3_product",
  });
}

/** Signature hero anchors — drives anchor stacks + depth (data-only, no UI). */
export type HeroVisualAnchorKind = "neural" | "depth" | "signal" | "holographic";

/** Z-order illusion: far = blurred backdrop forms, mid = frame/plane, near = content. */
export type DepthPlaneId = "far" | "mid" | "near";

export type HeroDepthPlaneStyle = {
  /** CSS background (gradient / color) */
  background: string;
  blur: string;
  opacity: number;
  scale: number;
  translateY: number;
  translateX: number;
};

export type HeroDepthVisual = {
  tier: 0 | 1 | 2 | 3;
  planes: {
    far: HeroDepthPlaneStyle;
    mid: {
      insetPx: number;
      border: string;
      shadow: string;
      opacity: number;
      blur: string;
      scale: number;
    };
    near: {
      contentShadow: string;
      contentLift: number;
    };
  };
  motion: {
    floatPx: number;
    durationSec: number;
    parallaxMidPx: number;
    pulseOpacity: [number, number];
  };
  /** Which anchor subsystems to render (stackable). */
  anchorFeatures: string[];
};

function hashSeedToInt(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Pseudo-3D depth + anchor stack hints for hero `content.visual.heroDepth`.
 * styleMode controls intensity; same structure is used in preview + static export.
 */
export function buildHeroDepthVisual(
  mode: StyleMode,
  anchor: HeroVisualAnchorKind,
  seed: string,
): HeroDepthVisual {
  const p = getPalette(mode);
  const profile = getEngineProfile(mode);
  const h = hashSeedToInt(seed);

  const tier: 0 | 1 | 2 | 3 =
    mode === "minimal" || profile === "stripped"
      ? 1
      : mode === "corporate" || profile === "reduced"
        ? 2
        : mode === "bold" || profile === "intense"
          ? 3
          : 3;

  const t = tier === 1 ? 0.55 : tier === 2 ? 0.78 : 1;
  const farBlur = tier === 1 ? "28px" : tier === 2 ? "38px" : "52px";
  const farOp = (0.28 + (h % 5) * 0.02) * t;
  const floatPx = tier <= 1 ? 3 : tier === 2 ? 5 : mode === "bold" ? 9 : 7;
  const parallax = tier <= 1 ? 2 : tier === 2 ? 4 : mode === "bold" ? 8 : 6;

  const farBg =
    mode === "corporate"
      ? `radial-gradient(ellipse 75% 55% at 72% 18%, ${p.accent}28, transparent 62%)`
      : `radial-gradient(ellipse 80% 60% at ${65 + (h % 8)}% ${15 + (h % 6)}%, ${p.accent}${tier >= 3 ? "55" : "40"}, transparent 58%), radial-gradient(ellipse 50% 40% at 20% 80%, ${p.glow}, transparent 55%)`;

  const midInset = tier === 1 ? 10 : tier === 2 ? 12 : 14;
  const midBlur = tier >= 3 && mode !== "minimal" ? "1px" : "0px";

  const anchorFeatures = buildHeroAnchorFeatureStack(mode, anchor, tier);

  return {
    tier,
    planes: {
      far: {
        background: farBg,
        blur: farBlur,
        opacity: Math.min(0.62, farOp + (anchor === "holographic" ? 0.06 : 0)),
        scale: tier >= 3 ? 1.09 : tier === 2 ? 1.05 : 1.02,
        translateY: tier <= 1 ? 4 : 10,
        translateX: anchor === "signal" ? -6 : (h % 6) - 3,
      },
      mid: {
        insetPx: midInset,
        border: `1px solid rgba(255,255,255,${tier === 1 ? 0.05 : 0.09})`,
        shadow:
          mode === "corporate"
            ? "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 12px 40px rgba(0,0,0,0.28)"
            : "inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 18px 50px rgba(0,0,0,0.42)",
        opacity: tier === 1 ? 0.12 : 0.22,
        blur: midBlur,
        scale: tier >= 3 ? 1.015 : 1,
      },
      near: {
        contentShadow:
          tier === 1
            ? "0 8px 28px rgba(0,0,0,0.35)"
            : `0 ${tier >= 3 ? 28 : 20}px ${tier >= 3 ? 72 : 52}px -14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,${tier >= 3 ? 0.1 : 0.07})`,
        contentLift: tier >= 3 && mode === "bold" ? 1.02 : 1,
      },
    },
    motion: {
      floatPx,
      durationSec: tier <= 1 ? 22 : tier === 2 ? 17 : 14,
      parallaxMidPx: parallax,
      pulseOpacity: tier <= 1 ? [0.18, 0.28] : [0.22, 0.38],
    },
    anchorFeatures,
  };
}

function buildHeroAnchorFeatureStack(
  mode: StyleMode,
  anchor: HeroVisualAnchorKind,
  tier: number,
): string[] {
  const rich = tier >= 2 && mode !== "minimal";
  switch (anchor) {
    case "neural":
      return rich
        ? ["mesh_back", "neural_cluster", "node_rail", "floating_cards"]
        : ["neural_cluster", "floating_cards"];
    case "depth":
      return rich ? ["far_glow", "stack_frames", "horizon_line", "split_plane"] : ["stack_frames", "split_plane"];
    case "signal":
      return rich ? ["far_glow", "signal_line", "data_panels", "pulse_dot"] : ["signal_line", "data_panels"];
    case "holographic":
      return rich ? ["holo_disc", "glow_frame", "glass_row", "ambient_sweep"] : ["holo_disc", "glow_frame", "glass_row"];
    default:
      return [];
  }
}

/** Compact metrics row for signal heroes — stored in `content.visual.dataPanels`. */
export function buildHeroDataPanels(seed: string): Array<{ label: string; value: string }> {
  const sets = [
    [
      { label: "Edge", value: "Live" },
      { label: "p95", value: "<48ms" },
    ],
    [
      { label: "Signal", value: "OK" },
      { label: "Sync", value: "Realtime" },
    ],
    [
      { label: "Route", value: "Optimal" },
      { label: "Load", value: "Balanced" },
    ],
  ];
  return sets[hashSeedToInt(seed) % sets.length]!;
}

/** Non-hero blocks — lighter than hero; stored in `content.visual.sectionDepth`. */
export type SectionDepthKind =
  | "stat_band"
  | "image_grid"
  | "visual_break_gradient"
  | "glow_strip"
  | "mid_cta"
  | "trust_strip"
  /** Social / narrative proof — lighter than stat_band, feature_grid, CTA. */
  | "proof_shallow";

/** Optional semantic hints for motif tuning (no schema change). */
export type SectionDepthMotifContext = {
  registryKey?: string;
  listVariant?: string;
  /** Previous or next block is rhythm-dense (hero, stat, grid, visual break). */
  adjacentDense?: boolean;
};

export type SectionDepthVisual = {
  kind: SectionDepthKind;
  /** 0 = flat … 2 = elevated (capped below hero tier) */
  tier: 0 | 1 | 2;
  shellShadow: string;
  cardShadow: string;
  farWash: string;
  insetFrame?: string;
  edgeGlow?: string;
  dividerGlow?: string;
  /** Signature micro-motifs for preview/static (data-only). */
  motifs: string[];
};

/**
 * Pseudo-3D / elevation for stat band, feature grid, breaks, CTA.
 * Respects rhythm: slot `visual` + dense blocks are slightly damped to avoid glow stack.
 */
export function buildSectionDepthVisual(
  kind: SectionDepthKind,
  mode: StyleMode,
  profile: EngineProfile,
  seed: string,
  rhythmSlot: RhythmSlot,
  ctx?: SectionDepthMotifContext,
): SectionDepthVisual {
  const p = getPalette(mode);
  const damp = profile === "stripped" ? 0.5 : rhythmSlot === 2 && kind !== "visual_break_gradient" && kind !== "glow_strip" ? 0.78 : 1;
  const rk = ctx?.registryKey;
  const adjacentDense = ctx?.adjacentDense === true;

  if (kind === "proof_shallow") {
    const profileTame = profile === "stripped" ? 0.62 : profile === "reduced" ? 0.78 : 0.88;
    const denseTame = adjacentDense ? 0.62 : 1;
    const slotTame = rhythmSlot === 2 ? 0.78 : 1;
    const comb = Math.min(1, profileTame * denseTame * slotTame);
    const accentAlpha = Math.max(4, Math.round(9 * comb));
    const farWash = `radial-gradient(ellipse 118% 72% at 50% -8%, ${p.accent}${accentAlpha} 0%, transparent 58%)`;
    const shellShadow = `inset 0 0 0 1px rgba(255,255,255,${0.028 + 0.02 * comb}), 0 1px 12px -10px rgba(0,0,0,${0.18 + 0.08 * comb})`;
    const cardShadow = `0 2px 10px -8px rgba(0,0,0,${0.12 + 0.06 * comb})`;
    const motifs: string[] = ["soft_proof_line", "calm_accent_lane"];
    if (comb > 0.52 && !adjacentDense) {
      motifs.push("faint_grid_fragment");
    }
    return {
      kind,
      tier: 0,
      shellShadow,
      cardShadow,
      farWash,
      insetFrame: undefined,
      edgeGlow: undefined,
      dividerGlow: undefined,
      motifs,
    };
  }

  let tier: 0 | 1 | 2 = profile === "stripped" ? 0 : profile === "reduced" ? 1 : 2;
  if (kind === "trust_strip") {
    tier = tier > 1 ? 1 : tier;
  }
  if (rhythmSlot === 2 && (kind === "stat_band" || kind === "image_grid" || kind === "mid_cta")) {
    tier = tier > 0 ? ((tier - 1) as 0 | 1) : 0;
  }

  const shellShadow = `0 ${10 + tier * 6}px ${26 + tier * 10}px -14px rgba(0,0,0,${0.36 + tier * 0.07}), inset 0 1px 0 rgba(255,255,255,${0.05 + tier * 0.04})`;
  const cardShadow = `0 ${8 + tier * 2}px ${22 + tier * 6}px -10px rgba(0,0,0,${0.38 + tier * 0.05})`;
  const farWashBase = `radial-gradient(ellipse 96% 68% at 50% 0%, ${p.accent}${Math.round(16 * damp)} 0%, transparent 54%)`;
  const farWashTrust = `radial-gradient(ellipse 88% 60% at 50% 8%, ${p.accent}${Math.round(10 * damp)} 0%, transparent 58%)`;
  const farWash = kind === "trust_strip" ? farWashTrust : farWashBase;
  const insetFrame =
    tier >= 1 && kind !== "trust_strip"
      ? `inset 0 0 0 1px rgba(255,255,255,${0.05 * damp + 0.02})`
      : kind === "trust_strip"
        ? `inset 0 0 0 1px rgba(255,255,255,${0.04 * damp + 0.02})`
        : undefined;
  const edgeGlow =
    kind === "trust_strip"
      ? `0 0 ${14 + tier * 3}px -14px ${p.glow}`
      : tier >= 1 && kind !== "visual_break_gradient"
        ? kind === "mid_cta"
          ? `0 0 ${22 + tier * 5}px -8px ${p.glow}`
          : `0 0 ${26 + tier * 6}px -8px ${p.glow}`
        : kind === "glow_strip"
          ? `0 -12px 40px -16px ${p.glow}`
          : undefined;
  const dividerGlow =
    kind === "visual_break_gradient" || kind === "glow_strip"
      ? `linear-gradient(90deg, transparent 0%, ${p.accent}70 48%, transparent 100%)`
      : undefined;

  const motifs: string[] = [];
  if (kind === "stat_band") {
    motifs.push("metric_emphasis", "restraint_motes", "glow_underline");
    if (profile !== "stripped" && rhythmSlot !== 2) motifs.push("node_rail_fragment");
  }
  if (kind === "image_grid") {
    if (rk === "feature_grid") {
      motifs.push("glass_row", "panel_frame", "card_elevation");
    } else {
      motifs.push("grid_fragment", "card_elevation");
    }
  }
  if (kind === "visual_break_gradient" || kind === "glow_strip") motifs.push("divider_lip", "carry_gradient");
  if (kind === "mid_cta") {
    motifs.push("glass_panel", "cta_clarity", "inherited_accent_lane");
  }
  if (kind === "trust_strip") {
    motifs.push("trust_calm_rail", "stabilizing_wash", "soft_edge");
  }

  return {
    kind,
    tier,
    shellShadow,
    cardShadow,
    farWash,
    insetFrame,
    edgeGlow,
    dividerGlow,
    motifs,
  };
}

/** Adjacent-section composition hints — `content.visual.continuity` (generator merge). */
export type ContinuityVisual = {
  bridge?: string;
  topLine?: string;
  ambientBleed?: string;
  inheritedAccent?: string;
  /** Faint signal ticks / dots */
  echoSignal?: boolean;
  /** Reduce edge glow when rhythm slot is already “visual” */
  softenGlow?: boolean;
};

export function buildContinuityVisual(
  mode: StyleMode,
  ctx: {
    blockType: string;
    variant?: string;
    prevType?: string;
    nextType?: string;
    sectionTone: "light" | "dark" | "visual";
    prevTone?: "light" | "dark" | "visual";
    rhythmSlot: RhythmSlot;
    prevRegistryKey?: string;
    nextRegistryKey?: string;
  },
): ContinuityVisual | undefined {
  const p = getPalette(mode);
  const { prevType, blockType, nextType, sectionTone, prevTone, rhythmSlot, variant, prevRegistryKey } = ctx;
  const out: ContinuityVisual = {};

  if (prevType === "hero") {
    const narrativeBleed = `radial-gradient(ellipse 100% 72% at 50% 0%, ${p.glow}16, transparent 62%)`;
    const defaultBleed = `radial-gradient(ellipse 100% 85% at 50% 0%, ${p.glow}22, transparent 58%)`;
    if (blockType === "paragraph" || blockType === "text") {
      out.ambientBleed = narrativeBleed;
      out.topLine = `linear-gradient(90deg, transparent 10%, ${p.accent}32 50%, transparent 90%)`;
      out.bridge = "hero_to_narrative";
    } else {
      out.ambientBleed = defaultBleed;
      out.topLine = `linear-gradient(90deg, transparent 6%, ${p.accent}42 50%, transparent 94%)`;
      out.bridge = "hero_exit";
    }
    if (blockType === "list" && variant === "trust_strip") {
      out.echoSignal = true;
      out.inheritedAccent = p.accent;
      out.ambientBleed = `radial-gradient(ellipse 100% 80% at 50% 0%, ${p.glow}18, transparent 60%)`;
      out.topLine = `linear-gradient(90deg, transparent 8%, ${p.accent}36 50%, transparent 92%)`;
      out.bridge = "hero_to_trust";
    }
  }

  if (prevType === "visual_break" && blockType === "stat_band") {
    out.bridge = "divider_to_metrics";
    out.topLine = `linear-gradient(90deg, transparent 0%, ${p.accent}38 50%, transparent 100%)`;
  }

  if (blockType === "stat_band" && prevType === "image_grid") {
    out.bridge = "grid_to_proof";
    out.ambientBleed = `linear-gradient(180deg, ${p.accent}08 0%, transparent 42%)`;
  }

  if (blockType === "visual_break" && prevType === "image_grid" && prevRegistryKey === "feature_grid") {
    out.bridge = "feature_grid_to_break";
    out.topLine = `linear-gradient(90deg, transparent 4%, ${p.accent}28 50%, transparent 96%)`;
    out.ambientBleed = `linear-gradient(180deg, ${p.accent}06 0%, transparent 48%)`;
  }

  if (blockType === "call_to_action") {
    if (prevType === "stat_band") {
      out.bridge = "stats_to_cta";
      out.inheritedAccent = p.accent;
      out.ambientBleed = `linear-gradient(180deg, ${p.accent}11 0%, transparent 56%)`;
    } else if (prevType === "image_grid") {
      out.bridge = "proof_to_cta";
      out.inheritedAccent = p.accent;
      out.ambientBleed = `linear-gradient(180deg, ${p.accent}10 0%, transparent 55%)`;
    } else if (prevType === "text" || (prevType === "paragraph" && prevRegistryKey === "paragraph_intro")) {
      out.bridge = "narrative_proof_to_cta";
      out.inheritedAccent = p.accent;
      out.ambientBleed = `linear-gradient(180deg, ${p.accent}08 0%, transparent 58%)`;
    }
  }

  if (nextType === "footer" && blockType === "call_to_action") {
    const base = out.bridge || "";
    out.bridge = base ? `${base}+cta_to_footer` : "cta_to_footer";
    out.topLine = out.topLine || `linear-gradient(90deg, transparent 12%, ${p.accent}28 52%, transparent 88%)`;
  }

  if (sectionTone === "light" && prevTone === "dark") {
    const base = out.bridge || "";
    out.bridge = base ? `${base}+tone_lift` : "tone_lift";
  }

  if (rhythmSlot === 2 && ["stat_band", "image_grid", "call_to_action", "list", "text", "paragraph"].includes(blockType)) {
    out.softenGlow = true;
  }

  const keys = Object.keys(out).filter((k) => out[k as keyof ContinuityVisual] !== undefined);
  return keys.length ? out : undefined;
}
