import type { SiteBuilderIntakeFields } from "@/lib/site-builder/ai/site-builder-intake";
import type { DesignDirection, DesignTokenProposal, SiteIntent } from "@/lib/site-builder/ai/schemas";

const CINEMATIC_KEYWORDS: Array<{ re: RegExp; weight: number }> = [
  { re: /\bcinematic\b/i, weight: 28 },
  { re: /\b(futuristic|future-?facing|sci-?fi)\b/i, weight: 20 },
  { re: /\bimmersive\b/i, weight: 18 },
  { re: /\b(movie-?like|trailer-?like|epic|showcase)\b/i, weight: 22 },
  { re: /\b(3d|volumetric|isometric|depth-?stack|layered|parallax)\b/i, weight: 16 },
  { re: /\b(neon|holograph|hologram|glow(ing)?|luminous|rim light)\b/i, weight: 20 },
  { re: /\bpremium\b/i, weight: 12 },
  { re: /\b(dramatic|bold visual|visually bold|visual impact|statement)\b/i, weight: 16 },
  { re: /\bhigh[-\s]?end|luxur(y|ious)|executive|boutique\b/i, weight: 14 },
  { re: /\b(animated?|animation|scroll-?reveal|motion-?ready|micro-?interactions)\b/i, weight: 10 },
  { re: /\bparallax\b/i, weight: 8 },
  { re: /\b(glass-?morphism|glass-?morphic|frosted glass)\b/i, weight: 12 },
  { re: /\bweb3|blockchain|on-?chain|decentrali[sz]ed|defi|dao|wallet\b/i, weight: 14 },
  { re: /\bmetaverse|nft|token(omics|ized)?\b/i, weight: 12 },
];

const MOOD_PATTERNS: Array<{ re: RegExp; mood: CinematicMood }> = [
  { re: /\b(cyberpunk|synth|blade runner|gritty neon|dark sci)\b/i, mood: "cyberpunk" },
  { re: /\b(luxury|luxe|vip|bespoke|concierge|gala)\b/i, mood: "luxury" },
  { re: /\b(enterprise|corporate|b2b|compliance|board-?room)\b/i, mood: "corporate" },
  { re: /\bweb3|blockchain|holograph|hologram|on-?chain\b/i, mood: "web3-holographic" },
  { re: /\b(futuristic|futurism|sci-?fi)\b/i, mood: "futuristic" },
  { re: /\b(editorial|magazine|serif|clean white|minimal(ist)?-?cinematic|quiet luxury)\b/i, mood: "minimal-cinematic" },
];

export type CinematicMood =
  | "futuristic"
  | "luxury"
  | "corporate"
  | "cyberpunk"
  | "minimal-cinematic"
  | "web3-holographic";

export type CinematicStyleHint = {
  designDirection?: DesignDirection;
  styleIntensity?: number;
  web3VisualMode?: boolean;
  siteType?: string;
};

export type CinematicDesignResult = {
  isCinematic: boolean;
  cinematicIntensity: number;
  mood: CinematicMood;
  visualDirectives: string[];
};

const MOOD_BASE: CinematicMood = "futuristic";

/**
 * Heuristic: whether the user asked for a visually rich, cinematic, or neon/Web3-leaning build.
 * Does not replace the planner; feeds narrative + token merge layers.
 */
export function detectCinematicDesignIntent(
  prompt: string,
  intake: SiteBuilderIntakeFields,
  style?: CinematicStyleHint,
): CinematicDesignResult {
  const full = [
    prompt,
    intake.industry,
    intake.market,
    intake.additionalNotes,
    intake.conversionGoal,
    intake.brandTone,
    intake.designPreference,
    intake.inspirationWebsites,
    intake.trustAndProof,
  ].join(" \n ");
  const lower = full.toLowerCase();
  let score = 0;
  for (const { re, weight } of CINEMATIC_KEYWORDS) {
    if (re.test(full)) score += weight;
  }
  if (style?.web3VisualMode) score += 18;
  if (style?.styleIntensity && style.styleIntensity > 70) score += 8;
  if (style?.siteType && /web3|decentrali/i.test(String(style.siteType))) score += 10;

  const isCinematic = score >= 32;

  let mood: CinematicMood = MOOD_BASE;
  for (const { re, mood: m } of MOOD_PATTERNS) {
    if (re.test(full)) {
      mood = m;
      break;
    }
  }

  if (style?.designDirection === "luxe" && mood === "futuristic") mood = "luxury";
  if (style?.designDirection === "operator" && mood === "futuristic") mood = "corporate";

  const visualDirectives: string[] = [];
  if (/\bhero\b|landing\b/i.test(full)) visualDirectives.push("Cinematic hero with clear focal hierarchy and premium spacing.");
  if (/\bgradient|gradient(s)?\b|mesh|nebula|aurora/i.test(full)) visualDirectives.push("Layered gradients, subtle mesh, or iridescent highlights.");
  if (/\bneon|glow|holograph/i.test(full)) visualDirectives.push("Glowing affordances, chroma sheen, and controlled bloom.");
  if (style?.web3VisualMode || /\bweb3|blockchain|wallet|chain|protocol\b/i.test(full)) {
    visualDirectives.push("Web3 / chain credibility: signal-forward, trust, network metaphors, optional holographic glass.");
  }

  if (!visualDirectives.length && isCinematic) {
    visualDirectives.push("Layered depth, dramatic hero, bold hierarchy, and motion-ready sections.");
  }

  const cinematicIntensity = Math.max(0, Math.min(100, Math.round(score * 0.6)));

  return { isCinematic, cinematicIntensity, mood, visualDirectives };
}

export type ExplicitVisualConstraints = {
  wantsLightBackground: boolean;
  wantsDarkBackground: boolean;
  wantsNoDark: boolean;
  /** Raw hints for palette */
  mentionedColors: string[];
  /** bold / minimal / etc. from copy */
  typographyMood: "bold" | "elegant" | "neutral" | "unknown";
  buttonStyle: "glow" | "glass" | "solid" | "minimal" | "unknown";
  userConstraintsWin: true;
};

/**
 * Surface explicit art-direction constraints so cinematic defaults (e.g. dark neon) do not override the user.
 */
export function extractExplicitVisualConstraints(fullText: string): ExplicitVisualConstraints {
  const t = fullText;
  const lower = t.toLowerCase();

  const wantsLightBackground =
    /\b(white|off[-\s]?white|light)\s+background\b/i.test(t) ||
    /\bbackground\s+(is\s+)?(to\s+)?(white|light|#fff|#ffffff|off-?white)\b/i.test(t) ||
    /\b(clean|bright)\s+white\s+(page|background|bg)\b/i.test(t);

  const wantsDarkBackground =
    /\b(dark|darker|midnight|night)\s+background\b/i.test(t) ||
    /\bbackground\s+to\s+(black|#0[0-9a-f]{5}|dark|charcoal|slate)\b/i.test(t);

  const wantsNoDark =
    /\bno\s+dark(?!en)?\b/i.test(lower) ||
    /\b(not|no)\s+(a\s+)?(dark|black)\s+(background|page|look|ui)\b/i.test(t) ||
    /\b(avoid|skip)\s+dark\b/i.test(lower);

  const mentionedColors: string[] = [];
  for (const m of t.matchAll(/#([0-9a-f]{3,8})\b|rgb(a)?\s*\([^\)]+\)/gi)) {
    mentionedColors.push(m[0]!);
  }
  if (/\b(blue|silver|gold|teal|emerald|violet|amber)\b/i.test(t)) {
    const c = t.match(
      /\b(royal|sky|navy|midnight)?\s*(blue|silver|gold|teal|emerald|violet|amber|sapphire|chrome)\b/gi,
    );
    if (c) for (const x of c) mentionedColors.push(x.trim().toLowerCase());
  }

  let typographyMood: ExplicitVisualConstraints["typographyMood"] = "unknown";
  if (/\b(bold(ened)?\s+text|heavy\s+type|loud\s+type|all[-\s]?caps\s+headlines)\b/i.test(t)) typographyMood = "bold";
  else if (/\b(elegant|serif|editorial|refined|thin)\s+(type|text|headline)\b/i.test(t)) typographyMood = "elegant";

  let buttonStyle: ExplicitVisualConstraints["buttonStyle"] = "unknown";
  if (/\b(glow(ing)?\s+button|glowing\s+cta|neon\s+button)\b/i.test(t)) buttonStyle = "glow";
  if (/\b(glass( morphism)?\s+button|frosted\s+button)\b/i.test(t)) buttonStyle = "glass";
  if (buttonStyle === "unknown" && /\b(solid|filled)\s+button\b/i.test(t)) buttonStyle = "solid";
  if (buttonStyle === "unknown" && /\b(minimal|text\s+link)\s+button\b/i.test(t)) buttonStyle = "minimal";

  return {
    wantsLightBackground,
    wantsDarkBackground: wantsDarkBackground && !wantsNoDark,
    wantsNoDark,
    mentionedColors: [...new Set(mentionedColors)].slice(0, 8),
    typographyMood,
    buttonStyle,
    userConstraintsWin: true,
  };
}

export const CINEMATIC_DIRECTIVE_TEXT = `CINEMATIC DESIGN DIRECTIVE
- Use layered depth, premium spacing, and strong visual hierarchy.
- Prefer cinematic hero layouts, immersive gradients, dynamic background treatments, bento or glassy panels, glowing or chrome CTAs, and high-contrast typography where appropriate.
- Match requested colors and backgrounds exactly when the user provides them; never ignore explicit color or light/dark preferences.
- If the user asks for white background and bold text, use a clean, editorial, cinematic look (not a dark cyberpunk look).
- If Web3 / blockchain is requested, add holographic or signal accents, network cues, and modern fintech credibility.
- If explicit constraints conflict with cinematic defaults, the user's constraints win.`;

/**
 * Merges detection + explicit constraints with the narrative user prompt.
 */
export function buildCinematicNarrativeEnrichment(
  userPrompt: string,
  intake: SiteBuilderIntakeFields,
  style: CinematicStyleHint | undefined,
  combinedTextForMatch: string,
): string {
  const c = detectCinematicDesignIntent(combinedTextForMatch, intake, style);
  const v = extractExplicitVisualConstraints(combinedTextForMatch);
  const extra: string[] = [];
  if (c.isCinematic) {
    extra.push(CINEMATIC_DIRECTIVE_TEXT);
    extra.push(`Cinematic mood: ${c.mood}. Stylistic focus: ${c.visualDirectives.join(" ")}`);
  }
  const constraintLines: string[] = [];
  if (v.wantsNoDark || v.wantsLightBackground) {
    constraintLines.push("USER CONSTRAINT: keep background light / white-leaning. Do not apply a dark or neon-cyber background.");
  } else if (v.wantsDarkBackground) {
    constraintLines.push("USER CONSTRAINT: prefer a dark, cinematic, or nocturnal background system.");
  }
  if (v.typographyMood === "bold") {
    constraintLines.push("USER CONSTRAINT: bold, high-contrast type (headlines and primary CTAs).");
  }
  if (v.buttonStyle !== "unknown") {
    constraintLines.push(`USER CONSTRAINT: primary buttons should feel **${v.buttonStyle}** (glow / glass / solid / minimal) as stated.`);
  }
  if (v.mentionedColors.length) {
    constraintLines.push(`Color hints from user: ${v.mentionedColors.join(", ")}.`);
  }
  if (constraintLines.length) {
    extra.push(constraintLines.join("\n"));
  }
  if (!extra.length) return userPrompt;
  return `${userPrompt}\n\n---\n${extra.join("\n\n")}`;
}

export function shouldForceLightCinematicPlatter(constraints: ExplicitVisualConstraints): boolean {
  return (constraints.wantsLightBackground || constraints.wantsNoDark) && !constraints.wantsDarkBackground;
}

export function shouldForceDarkCinematicPlatter(constraints: ExplicitVisualConstraints): boolean {
  return constraints.wantsDarkBackground && !constraints.wantsNoDark;
}

export type VisualDirectionRecord = {
  mood: string;
  background: string;
  colorPalette: string;
  imageryStyle: string;
  lighting: string;
  composition: string;
  animationHints: string;
};

/** Human-readable art direction lines for `metadata.visualDirection`. */
export function buildVisualDirectionSummary(
  c: CinematicDesignResult,
  constraints: ExplicitVisualConstraints,
  designTokens: DesignTokenProposal,
  intent: SiteIntent,
): VisualDirectionRecord {
  const bgMode = String(designTokens.backgroundMode ?? "");
  const moodLine = c.mood.replace(/-/g, " ");
  let background =
    bgMode === "white-editorial"
      ? "Cinematic white editorial surface with generous negative space and crisp section rhythm."
      : bgMode === "dark-cinematic" || bgMode === "holographic-gradient"
        ? "Dark holographic canvas with layered depth, soft grain, and network-light accents."
        : bgMode === "glass-grid"
          ? "Glass grid system with frosted panels and premium spacing."
          : bgMode === "luxury-minimal"
            ? "Premium minimal field with chrome edges, warm neutrals, and quiet contrast."
            : `Layered ${bgMode || "gradient"} background aligned to ${intent.replace(/_/g, " ")} intent.`;

  if (constraints.wantsLightBackground || constraints.wantsNoDark) {
    background =
      "Light, editorial cinematic field — user requested a bright background; avoid default dark cyberpunk unless they asked for it.";
  }

  const palette =
    designTokens.accent && designTokens.gradientStart
      ? `Accent ${designTokens.accent} over ${designTokens.gradientStart} → ${designTokens.gradientEnd || "muted"}.`
      : constraints.mentionedColors.length
        ? `User palette hints: ${constraints.mentionedColors.join(", ")}.`
        : "High-contrast typographic palette with one hero accent and neutral surfaces.";

  const imagery =
    c.mood === "web3-holographic"
      ? "Abstract network nodes, token-adjacent glyphs, and trust-forward fintech cues (no real token claims)."
      : c.mood === "luxury"
        ? "Editorial photography placeholders, serif-forward hierarchy, restrained ornament."
        : "Wide hero art direction with cinematic crop and optional product or abstract stills.";

  const lighting =
    designTokens.gradientStyle === "neon-radial"
      ? "Rim light and controlled neon bloom on interactive affordances."
      : designTokens.gradientStyle === "chrome"
        ? "Soft specular highlights and metal-edge sheen on CTAs."
        : "Directional key light on hero, ambient fill in supporting rows.";

  const composition = c.isCinematic
    ? "Foreground headline lockup, mid-ground proof, background depth haze; grid discipline for bento feature rows."
    : "Standard marketing stack with clear vertical rhythm.";

  const animationHints =
    designTokens.motionHint === "floating-orbs"
      ? "Sparse floating orbs / parallax-ready layers; keep motion subtle in preview."
      : designTokens.motionHint === "scroll-reveal"
        ? "Scroll-linked reveals on stat and feature rows."
        : designTokens.motionHint === "subtle-parallax"
          ? "Subtle parallax on hero mesh and CTA sheen."
          : "Baseline fade/slide entrance only.";

  return {
    mood: moodLine,
    background,
    colorPalette: palette,
    imageryStyle: imagery,
    lighting,
    composition,
    animationHints,
  };
}
