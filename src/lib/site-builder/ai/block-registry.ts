import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import {
  buildHeroDataPanels,
  buildHeroDepthVisual,
  buildSectionVisualLayers,
  defaultMotionForMode,
  effectiveStyleModeFromPlanner,
  getEngineProfile,
  getPalette,
  TROOTHERTZ_SIGNATURE,
  type HeroDepthVisual,
  type StyleMode,
} from "@/lib/site-builder/ai/visual-tokens";

type SiteBlock = SiteSchemaDocumentType["pages"][number]["blocks"][number];

export type BlockBuildContext = {
  planner: SitePlannerOutput;
  /** Stable id for targeted regeneration */
  sectionId: string;
  /** Deterministic copy variation */
  seed: string;
  /** Headline when this section is not listed on `planner.sectionPlan` (e.g. auxiliary routes). */
  sectionHeadline?: string;
};

export type RegistryEntry = {
  id: string;
  label: string;
  description: string;
  build: (ctx: BlockBuildContext) => SiteBlock;
};

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string): T {
  const idx = hashSeed(seed) % arr.length;
  return arr[idx]!;
}

function styleModeFromPlanner(planner: SitePlannerOutput): StyleMode {
  return effectiveStyleModeFromPlanner(planner);
}

type HeroVariant = "primary_glow" | "primary_split" | "primary_grid";

type HeroVisualAnchor = "neural" | "depth" | "signal" | "holographic";

const ANCHOR_LABELS: Record<HeroVisualAnchor, Array<{ id: string; label: string }>> = {
  neural: [
    { id: "n1", label: "Intent graph" },
    { id: "n2", label: "Trust mesh" },
    { id: "n3", label: "Flow edge" },
    { id: "n4", label: "Node cluster" },
  ],
  depth: [
    { id: "d1", label: "Foreground" },
    { id: "d2", label: "Mid layer" },
    { id: "d3", label: "Horizon" },
    { id: "d4", label: "Depth stack" },
  ],
  signal: [
    { id: "s1", label: "Live signal" },
    { id: "s2", label: "Edge sync" },
  ],
  holographic: [
    { id: "h1", label: "Chroma plane" },
    { id: "h2", label: "Parallax" },
    { id: "h3", label: "Glass stack" },
  ],
};

function makeHero(
  ctx: BlockBuildContext,
  variant: HeroVariant,
  registryKey: string,
  anchor?: HeroVisualAnchor,
): SiteBlock {
  const { planner, seed, sectionId } = ctx;
  const mode = styleModeFromPlanner(planner);
  const profile = getEngineProfile(mode);
  const layers = buildSectionVisualLayers(mode, seed, profile);
  const motion = defaultMotionForMode(mode, profile);
  const p = getPalette(mode);
  const title =
    ctx.sectionHeadline?.trim() ||
    planner.sectionPlan.find((s) => s.id === sectionId)?.headline?.trim() ||
    planner.normalizedBrief.slice(0, 72) ||
    "Your next chapter starts here";
  const subtitles = [
    `${planner.brandVoice.tone} experience — built for ${planner.conversionGoal}.`,
    `Designed for clarity, trust, and ${planner.conversionGoal.toLowerCase()}.`,
    `${planner.intent.replace(/_/g, " ")} positioning with a polished, layered layout.`,
  ];
  const floating =
    variant === "primary_grid"
      ? pick(
          [
            ["Fast", "Reliable", "Trusted"],
            ["Secure", "Composable", "Live"],
            ["Clear", "Proven", "Ready"],
          ],
          seed + "float"
        )
      : undefined;

  const sigFloat =
    anchor && variant === "primary_glow"
      ? pick(
          [
            [
              { label: "Mesh live" },
              { label: "Verified" },
              { label: "Graph OK" },
            ],
            [
              { label: "Signal" },
              { label: "Flow" },
              { label: "Trust" },
            ],
            [
              { label: "Edge" },
              { label: "Live" },
            ],
          ],
          seed + "sigfloat"
        )
      : undefined;

  const baseCards = floating?.map((t) => ({ label: t })) ?? [];
  const mergedFloat =
    variant === "primary_grid"
      ? baseCards
      : anchor && sigFloat
        ? [...sigFloat, ...baseCards]
        : baseCards;

  const visual: Record<string, unknown> = {
    gradient: layers.gradient,
    glowShadow: layers.glowShadow,
    noise: layers.noiseOpacity,
    gridOverlay: layers.gridOpacity,
    accent: p.accent,
    surface: p.surface,
    ...(mergedFloat.length > 0 ? { floatingCards: mergedFloat } : {}),
    depth: variant === "primary_glow" || variant === "primary_grid",
    animateBackground: layers.animateBackground,
    ambientGlow: layers.ambientGlow,
    signature: TROOTHERTZ_SIGNATURE,
  };
  let heroDepth: HeroDepthVisual | undefined;
  if (anchor) {
    heroDepth = buildHeroDepthVisual(mode, anchor, seed);
    visual.anchor = anchor;
    visual.anchors = ANCHOR_LABELS[anchor];
    visual.heroDepth = heroDepth;
    visual.anchorFeatures = heroDepth.anchorFeatures;
    if (anchor === "signal") {
      visual.dataPanels = buildHeroDataPanels(seed);
    }
  }

  return {
    type: "hero",
    content: {
      title,
      subtitle: pick(subtitles, seed + "sub"),
      variant,
      layout: variant === "primary_split" ? "split" : variant === "primary_grid" ? "grid" : "stack",
      aiSectionId: sectionId,
      aiRegistryKey: registryKey,
      visual,
      motion: {
        entrance: motion.entrance,
        staggerChildren: variant === "primary_grid" ? motion.stagger : motion.stagger * 0.7,
        hover: motion.hover,
        ...(motion.backgroundPulse !== undefined ? { backgroundPulse: motion.backgroundPulse } : {}),
        ...(heroDepth
          ? {
              depthFloatPx: heroDepth.motion.floatPx,
              depthParallaxPx: heroDepth.motion.parallaxMidPx,
            }
          : {}),
      },
    },
  };
}

function baseHero(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_glow", "hero_primary");
}

function heroGlow(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_glow", "hero_primary_glow");
}

function heroSplit(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_split", "hero_primary_split");
}

function heroGrid(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_grid", "hero_primary_grid");
}

function heroNeural(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_glow", "hero_primary_neural", "neural");
}

function heroDepth(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_split", "hero_primary_depth", "depth");
}

function heroSignal(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_glow", "hero_primary_signal", "signal");
}

function heroHolographic(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_glow", "hero_primary_holographic", "holographic");
}

/** Cinematic alias: split hero with registry key for planner / regen. */
function heroCinematicSplit(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_split", "hero_cinematic_split", "depth");
}

function heroHolographicDepth(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_glow", "hero_holographic_depth", "holographic");
}

function heroWhiteEditorialBold(ctx: BlockBuildContext): SiteBlock {
  return makeHero(ctx, "primary_split", "hero_white_editorial_bold", "signal");
}

function valueProps(ctx: BlockBuildContext): SiteBlock {
  const { planner, seed, sectionId } = ctx;
  const mode = styleModeFromPlanner(planner);
  const motion = defaultMotionForMode(mode, getEngineProfile(mode));
  const items = [
    `Structured narrative aligned to: ${planner.brandVoice.keywords.slice(0, 3).join(", ") || "your positioning"}.`,
    `Conversion focus: ${planner.conversionGoal}.`,
    `Sections are layered with motion defaults — edit one block without rewriting the full page.`,
  ];
  return {
    type: "list",
    items: items.map((t, i) => `${i + 1}. ${t}`),
    content: {
      aiSectionId: sectionId,
      aiRegistryKey: "value_props",
      motion: { entrance: motion.entrance, stagger: motion.stagger },
    },
  };
}

function trustStrip(ctx: BlockBuildContext): SiteBlock {
  const { planner, sectionId, seed } = ctx;
  const mode = styleModeFromPlanner(planner);
  const p = getPalette(mode);
  const chips = pick(
    [
      ["SOC2-ready posture", "Wallet-native", "Operator-grade"],
      ["Auditable", "Transparent", "Composable"],
      ["Trusted flow", "Clear terms", "Human support"],
    ],
    seed + "trust"
  );
  return {
    type: "list",
    items: chips,
    content: {
      variant: "trust_strip",
      aiSectionId: sectionId,
      aiRegistryKey: "trust_strip",
      visual: { accent: p.accent, chips: true },
      motion: { stagger: 0.06 },
    },
  };
}

function trustNetworkGrid(ctx: BlockBuildContext): SiteBlock {
  const b = trustStrip(ctx);
  const c = (b.content || {}) as Record<string, unknown>;
  c.aiRegistryKey = "trust_network_grid";
  c.visual = { ...((c.visual as object) || {}), networkGrid: true, nodeAccent: true };
  b.content = c;
  return b;
}

/** Single-image section for imported blueprints; Refine merges prior src/alt when rebuilding. */
function imageSpotlight(ctx: BlockBuildContext): SiteBlock {
  const { planner, sectionId, seed } = ctx;
  const mode = styleModeFromPlanner(planner);
  const m = defaultMotionForMode(mode, getEngineProfile(mode));
  return {
    type: "image",
    src: "",
    content: {
      alt: pick(["Imported visual", "Key image", "Brand frame"], seed + "imgalt"),
      aiSectionId: sectionId,
      aiRegistryKey: "image_spotlight",
      motion: { entrance: m.entrance },
    },
  };
}

function featureGrid(ctx: BlockBuildContext): SiteBlock {
  const { planner, seed, sectionId } = ctx;
  const mode = styleModeFromPlanner(planner);
  const profile = getEngineProfile(mode);
  const layers = buildSectionVisualLayers(mode, seed + "fg", profile);
  const kw = planner.brandVoice.keywords.slice(0, 4);
  const images = kw.map((label) => ({
    src: "",
    alt: `${label || "Feature"} — add imagery in the editor`,
  }));
  return {
    type: "image_grid",
    content: {
      images,
      aiSectionId: sectionId,
      aiRegistryKey: "feature_grid",
      visual: {
        gradient: layers.gradient,
        gridOverlay: layers.gridOpacity,
        cardHover: true,
      },
      motion: { stagger: defaultMotionForMode(mode, profile).stagger, hover: "lift" },
    },
  };
}

function featureBentoGlass(ctx: BlockBuildContext): SiteBlock {
  const b = featureGrid(ctx);
  const c = (b.content || {}) as Record<string, unknown>;
  const v = (c.visual as Record<string, unknown> | undefined) || {};
  c.aiRegistryKey = "feature_bento_glass";
  c.visual = {
    ...v,
    bento: true,
    glassMorphism: 0.62,
    rimLight: true,
  };
  b.content = c;
  return b;
}

function statBand(ctx: BlockBuildContext): SiteBlock {
  const { planner, sectionId, seed } = ctx;
  const mode = styleModeFromPlanner(planner);
  const profile = getEngineProfile(mode);
  const p = getPalette(mode);
  const sets = [
    [
      { value: "10k+", label: "Operators" },
      { value: "99.9%", label: "Uptime" },
      { value: "24/7", label: "Support" },
    ],
    [
      { value: "120+", label: "Deployments" },
      { value: "50ms", label: "p95" },
      { value: "∞", label: "Iterations" },
    ],
  ];
  const stats = pick(sets, seed + "stats");
  const bandIntensity = profile === "stripped" ? 0.12 : profile === "intense" ? 0.42 : 0.28;
  return {
    type: "stat_band",
    content: {
      stats,
      aiSectionId: sectionId,
      aiRegistryKey: "stat_band",
      visual: {
        gradient: `linear-gradient(100deg, ${p.accent}08 0%, transparent 35%, ${p.accent}18 50%, transparent 65%, ${p.accent}0d 100%)`,
        glow: p.glow,
        ringAccent: p.accent,
        bandIntensity,
        edgeGlow: profile !== "stripped",
        signature: TROOTHERTZ_SIGNATURE,
      },
      motion: { stagger: profile === "intense" ? 0.12 : 0.08, entrance: "fadeUp", hover: "lift" },
    },
  };
}

function visualBreakGradient(ctx: BlockBuildContext): SiteBlock {
  const { sectionId, seed } = ctx;
  const mode = styleModeFromPlanner(ctx.planner);
  const profile = getEngineProfile(mode);
  const p = getPalette(mode);
  const shimmer = profile !== "stripped";
  return {
    type: "visual_break",
    content: {
      variant: "gradient_divider",
      aiSectionId: sectionId,
      aiRegistryKey: "visual_break_gradient",
      visual: {
        gradient: `linear-gradient(92deg, ${p.accent}00 0%, ${p.accent}4d 35%, ${p.accent}80 50%, ${p.accent}4d 65%, ${p.accent}00 100%)`,
        height: profile === "intense" ? 4 : 3,
        noise: profile === "stripped" ? 0.008 : 0.028,
        shimmer,
        signature: TROOTHERTZ_SIGNATURE,
      },
      motion: { entrance: "fade", backgroundPulse: shimmer },
    },
  };
}

function glowStrip(ctx: BlockBuildContext): SiteBlock {
  const { sectionId, seed } = ctx;
  const mode = styleModeFromPlanner(ctx.planner);
  const profile = getEngineProfile(mode);
  const p = getPalette(mode);
  const h = profile === "intense" ? 88 : profile === "stripped" ? 56 : 72;
  return {
    type: "visual_break",
    content: {
      variant: "glow_strip",
      aiSectionId: sectionId,
      aiRegistryKey: "glow_strip",
      visual: {
        gradient: `linear-gradient(180deg, transparent 0%, ${p.accent}22 40%, ${p.glow} 55%, transparent 100%), ${p.gradient}`,
        glowShadow: `0 -24px 72px -18px ${p.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
        height: h,
        shimmerBand: profile !== "stripped",
        signature: TROOTHERTZ_SIGNATURE,
      },
      motion: { entrance: "fadeUp", backgroundPulse: profile !== "stripped" },
    },
  };
}

function midCta(ctx: BlockBuildContext): SiteBlock {
  const { planner, sectionId, seed } = ctx;
  const mode = styleModeFromPlanner(planner);
  const m = defaultMotionForMode(mode, getEngineProfile(mode));
  return {
    type: "call_to_action",
    content: {
      title: pick(
        [`Move visitors toward: ${planner.conversionGoal}`, `Primary conversion: ${planner.conversionGoal}`, "Ready when you are"],
        seed + "cta"
      ),
      body: "Polished card with hover motion — swap copy anytime.",
      label: pick(["Continue", "Book a walkthrough", "See details", "Get started"], seed + "lbl"),
      href: "#contact",
      aiSectionId: sectionId,
      aiRegistryKey: "mid_cta",
      visual: { elevated: true },
      motion: { hover: m.hover, entrance: m.entrance },
    },
  };
}

function ctaGlowPanel(ctx: BlockBuildContext): SiteBlock {
  const b = midCta(ctx);
  const c = (b.content || {}) as Record<string, unknown>;
  const p = getPalette(styleModeFromPlanner(ctx.planner));
  c.aiRegistryKey = "cta_glow_panel";
  c.visual = { ...((c.visual as object) || {}), glowPanel: true, chromeEdge: true, ringGlow: p.glow };
  b.content = c;
  return b;
}

function pricingCinematicCards(ctx: BlockBuildContext): SiteBlock {
  const b = featureGrid(ctx);
  const c = (b.content || {}) as Record<string, unknown>;
  c.aiRegistryKey = "pricing_cinematic_cards";
  c.visual = { ...((c.visual as object) || {}), pricingLayout: true, cinematicCards: true };
  b.content = c;
  return b;
}

function agentShowcaseOrb(ctx: BlockBuildContext): SiteBlock {
  const b = midCta(ctx);
  const c = (b.content || {}) as Record<string, unknown>;
  c.title = "Agent / assistant — ready to deploy";
  c.body = "Showcase your support or AI agent on a glass orb panel with clear trust framing.";
  c.aiRegistryKey = "agent_showcase_orb";
  c.visual = { ...((c.visual as object) || {}), agentOrb: true, halo: true };
  b.content = c;
  return b;
}

function socialProof(ctx: BlockBuildContext): SiteBlock {
  const { sectionId } = ctx;
  return {
    type: "text",
    content: {
      body: "Trust layer: connect wallet-aware personalization and token gates after launch — contract writes stay manual/approved.",
      aiSectionId: sectionId,
      aiRegistryKey: "social_proof",
    },
  };
}

function web3ProofNetwork(ctx: BlockBuildContext): SiteBlock {
  const b = socialProof(ctx);
  const c = (b.content || {}) as Record<string, unknown>;
  c.body =
    "On-chain proof posture: verifiable references, network visual language, and explicit compliance boundaries — no implied yield or guarantees.";
  c.aiRegistryKey = "web3_proof_network";
  c.visual = { chainTrust: true, nodeGrid: true };
  b.content = c;
  return b;
}

function faqBlock(ctx: BlockBuildContext): SiteBlock {
  const { planner, sectionId, seed } = ctx;
  const body = [
    `Q: What is the primary goal?\nA: ${planner.conversionGoal}`,
    `Q: Who is this for?\nA: ${planner.intent.replace(/_/g, " ")} audiences.`,
    `Q: Can I edit one section only?\nA: Yes — use targeted regen to avoid full-page churn.`,
  ].join("\n\n");
  return {
    type: "section",
    content: {
      title: pick(["FAQ", "Questions", "Details"], seed + "faq"),
      body,
      aiSectionId: sectionId,
      aiRegistryKey: "faq",
    },
  };
}

function footerBlock(ctx: BlockBuildContext): SiteBlock {
  const { planner, sectionId } = ctx;
  return {
    type: "footer",
    content: {
      body: `© ${new Date().getFullYear()} — ${planner.sitemap[0]?.title || "Site"}. ${planner.normalizedBrief.slice(0, 120)}`,
      aiSectionId: sectionId,
      aiRegistryKey: "footer_standard",
    },
  };
}

function web3Ribbon(ctx: BlockBuildContext): SiteBlock {
  const { sectionId } = ctx;
  return {
    type: "heading",
    content: {
      text: "Web3-ready surface",
      level: "h2",
      aiSectionId: sectionId,
      aiRegistryKey: "web3_ribbon",
    },
  };
}

function paragraphIntro(ctx: BlockBuildContext): SiteBlock {
  const { planner, sectionId } = ctx;
  const mode = styleModeFromPlanner(planner);
  return {
    type: "paragraph",
    content: {
      text: planner.normalizedBrief.slice(0, 600) || "Operator narrative placeholder — refine in the editor.",
      aiSectionId: sectionId,
      aiRegistryKey: "paragraph_intro",
      motion: { entrance: defaultMotionForMode(mode, getEngineProfile(mode)).entrance },
    },
  };
}

export const SITE_BUILDER_BLOCK_TYPES = new Set([
  "hero",
  "text",
  "image",
  "button",
  "section",
  "footer",
  "avatar",
  "heading",
  "paragraph",
  "link",
  "socials",
  "image_grid",
  "list",
  "divider",
  "big_link",
  "internal_big_link",
  "header_image",
  "audio",
  "file",
  "video",
  "call_to_action",
  "visual_break",
  "stat_band",
]);

export const BLOCK_REGISTRY: Record<string, RegistryEntry> = {
  hero_primary: {
    id: "hero_primary",
    label: "Hero",
    description: "Primary hero (glow layout)",
    build: baseHero,
  },
  hero_primary_glow: {
    id: "hero_primary_glow",
    label: "Hero · Glow",
    description: "Hero with gradient, glow, noise, and grid overlay",
    build: heroGlow,
  },
  hero_primary_split: {
    id: "hero_primary_split",
    label: "Hero · Split",
    description: "Split hero with layered background",
    build: heroSplit,
  },
  hero_primary_grid: {
    id: "hero_primary_grid",
    label: "Hero · Grid",
    description: "Hero with floating emphasis cards",
    build: heroGrid,
  },
  hero_primary_neural: {
    id: "hero_primary_neural",
    label: "Hero · Neural",
    description: "TROOTHHERTZ neural mesh hero with anchor nodes",
    build: heroNeural,
  },
  hero_primary_depth: {
    id: "hero_primary_depth",
    label: "Hero · Depth",
    description: "Split hero with depth-stack visual anchors",
    build: heroDepth,
  },
  hero_primary_signal: {
    id: "hero_primary_signal",
    label: "Hero · Signal",
    description: "Signal-line hero with live-edge anchor",
    build: heroSignal,
  },
  hero_primary_holographic: {
    id: "hero_primary_holographic",
    label: "Hero · Holographic",
    description: "Iridescent plane hero with chroma anchors",
    build: heroHolographic,
  },
  hero_cinematic_split: {
    id: "hero_cinematic_split",
    label: "Hero · Cinematic split",
    description: "Cinematic split hero with depth anchors",
    build: heroCinematicSplit,
  },
  hero_holographic_depth: {
    id: "hero_holographic_depth",
    label: "Hero · Holographic depth",
    description: "Holographic depth-stack hero",
    build: heroHolographicDepth,
  },
  hero_white_editorial_bold: {
    id: "hero_white_editorial_bold",
    label: "Hero · White editorial",
    description: "Editorial split hero for light cinematic surfaces",
    build: heroWhiteEditorialBold,
  },
  paragraph_intro: {
    id: "paragraph_intro",
    label: "Intro paragraph",
    description: "Long-form intro from brief",
    build: paragraphIntro,
  },
  trust_strip: {
    id: "trust_strip",
    label: "Trust strip",
    description: "Horizontal trust chips",
    build: trustStrip,
  },
  trust_network_grid: {
    id: "trust_network_grid",
    label: "Trust · Network grid",
    description: "Trust strip with network-grid visual cue",
    build: trustNetworkGrid,
  },
  value_props: {
    id: "value_props",
    label: "Value props",
    description: "Numbered list of value props",
    build: valueProps,
  },
  feature_grid: {
    id: "feature_grid",
    label: "Feature grid",
    description: "Image grid with layered frame",
    build: featureGrid,
  },
  feature_bento_glass: {
    id: "feature_bento_glass",
    label: "Feature · Bento glass",
    description: "Bento / glassmorphism feature grid",
    build: featureBentoGlass,
  },
  image_spotlight: {
    id: "image_spotlight",
    label: "Image spotlight",
    description: "Single hero-style image block (import / spotlight)",
    build: imageSpotlight,
  },
  stat_band: {
    id: "stat_band",
    label: "Stat band",
    description: "Key metrics row",
    build: statBand,
  },
  visual_break_gradient: {
    id: "visual_break_gradient",
    label: "Visual break",
    description: "Gradient divider strip",
    build: visualBreakGradient,
  },
  glow_strip: {
    id: "glow_strip",
    label: "Glow strip",
    description: "Tall glow band for rhythm",
    build: glowStrip,
  },
  mid_cta: {
    id: "mid_cta",
    label: "Mid-page CTA",
    description: "Call to action block",
    build: midCta,
  },
  cta_glow_panel: {
    id: "cta_glow_panel",
    label: "CTA · Glow panel",
    description: "Premium glowing CTA surface",
    build: ctaGlowPanel,
  },
  pricing_cinematic_cards: {
    id: "pricing_cinematic_cards",
    label: "Pricing · Cinematic",
    description: "Pricing-style cinematic cards",
    build: pricingCinematicCards,
  },
  agent_showcase_orb: {
    id: "agent_showcase_orb",
    label: "Agent · Orb showcase",
    description: "Agent or chat surface with orb emphasis",
    build: agentShowcaseOrb,
  },
  social_proof: {
    id: "social_proof",
    label: "Trust note",
    description: "Short trust / proof text",
    build: socialProof,
  },
  web3_proof_network: {
    id: "web3_proof_network",
    label: "Web3 · Proof network",
    description: "Web3 / chain credibility text block",
    build: web3ProofNetwork,
  },
  web3_ribbon: {
    id: "web3_ribbon",
    label: "Web3 heading ribbon",
    description: "Section heading for web3 mode",
    build: web3Ribbon,
  },
  faq: {
    id: "faq",
    label: "FAQ",
    description: "FAQ section block",
    build: faqBlock,
  },
  footer_standard: {
    id: "footer_standard",
    label: "Footer",
    description: "Footer with copyright line",
    build: footerBlock,
  },
};

export function listRegistryKeys(): string[] {
  return Object.keys(BLOCK_REGISTRY);
}

export function getRegistryEntry(key: string): RegistryEntry | null {
  return BLOCK_REGISTRY[key] ?? null;
}
