import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";

/** Enforced structural contract for deterministic + post-planner reconciliation. */
export type LayoutFamilyEnforcement = {
  sectionCountMin: number;
  sectionCountMax: number;
  /** Registry keys safe to drop (in order) when trimming over max count — never hero/footer. */
  expendableRegistryKeys: readonly string[];
  /**
   * First `trust_strip` / `trust_network_grid` must land at or before this index (0 = hero only above).
   * Omit when the family does not mandate an early trust strip.
   */
  trustEarlyMaxIndex?: number;
  /** Minimum index (0-based) of first conversion block (`mid_cta`, `cta_glow_panel`, `pricing_cinematic_cards`). */
  firstCtaMinIndex?: number;
  /** Soft cap on conversion blocks excluding footer (rhythm guard). */
  maxCtas?: number;
};

export type LayoutFamily = {
  id:
    | "cinematic_hero_journey"
    | "split_authority"
    | "conversion_funnel"
    | "editorial_story"
    | "product_showcase"
    | "local_service"
    | "premium_minimal"
    | "web3_immersive";
  label: string;
  intent: string;
  preferredSectionOrder: string[];
  heroStyle: string;
  ctaStrategy: string;
  visualDensity: "low" | "medium" | "high";
  trustPattern: string;
  bestForIndustries: string[];
  enforcement: LayoutFamilyEnforcement;
};

export const LAYOUT_FAMILIES: LayoutFamily[] = [
  {
    id: "cinematic_hero_journey",
    label: "Cinematic Hero Journey",
    intent: "Narrative-first launch journey with immersive progression",
    preferredSectionOrder: ["hero", "intro", "value_props", "stat_band", "visual_break", "cta", "proof", "faq"],
    heroStyle: "cinematic layered hero",
    ctaStrategy: "single staged CTA",
    visualDensity: "high",
    trustPattern: "proof after narrative",
    bestForIndustries: ["media", "creative", "web3", "premium services"],
  },
  {
    id: "split_authority",
    label: "Split Authority",
    intent: "Proof-led authority structure with split framing",
    preferredSectionOrder: ["hero", "trust_strip", "value_props", "feature_grid", "social_proof", "cta", "faq"],
    heroStyle: "split proof-led",
    ctaStrategy: "book consult",
    visualDensity: "medium",
    trustPattern: "early credibility + case proof",
    bestForIndustries: ["consulting", "legal", "trust services", "b2b"],
    enforcement: {
      sectionCountMin: 8,
      sectionCountMax: 11,
      expendableRegistryKeys: ["faq", "visual_break_gradient", "glow_strip"],
      trustEarlyMaxIndex: 1,
      firstCtaMinIndex: 4,
      maxCtas: 2,
    },
  },
  {
    id: "conversion_funnel",
    label: "Conversion Funnel",
    intent: "Offer-first conversion flow with repeated CTA reinforcement",
    preferredSectionOrder: ["hero", "value_props", "feature_grid", "proof", "pricing", "faq", "cta"],
    heroStyle: "offer-driven hero",
    ctaStrategy: "repeated conversion CTA",
    visualDensity: "medium",
    trustPattern: "proof near pricing",
    bestForIndustries: ["saas", "ecommerce", "lead gen"],
    enforcement: {
      sectionCountMin: 8,
      sectionCountMax: 12,
      expendableRegistryKeys: ["faq", "glow_strip", "visual_break_gradient"],
      firstCtaMinIndex: 3,
      maxCtas: 3,
    },
  },
  {
    id: "editorial_story",
    label: "Editorial Story",
    intent: "Long-form editorial narrative with selective conversion points",
    preferredSectionOrder: ["hero", "paragraph_intro", "trust_strip", "feature_grid", "visual_break", "social_proof", "cta"],
    heroStyle: "editorial statement",
    ctaStrategy: "late contextual CTA",
    visualDensity: "low",
    trustPattern: "credibility woven into story",
    bestForIndustries: ["portfolio", "content", "education", "thought leadership"],
    enforcement: {
      sectionCountMin: 8,
      sectionCountMax: 11,
      expendableRegistryKeys: ["faq", "visual_break_gradient", "glow_strip"],
      trustEarlyMaxIndex: 2,
      firstCtaMinIndex: 5,
      maxCtas: 2,
    },
  },
  {
    id: "product_showcase",
    label: "Product Showcase",
    intent: "Capability showcase with demos, features, and outcomes",
    preferredSectionOrder: ["hero", "feature_grid", "stat_band", "value_props", "social_proof", "cta", "faq"],
    heroStyle: "product preview",
    ctaStrategy: "start trial / demo",
    visualDensity: "medium",
    trustPattern: "quant proof + logos",
    bestForIndustries: ["saas", "apps", "tooling", "product-led teams"],
    enforcement: {
      sectionCountMin: 8,
      sectionCountMax: 12,
      expendableRegistryKeys: ["faq", "glow_strip", "visual_break_gradient", "stat_band"],
      firstCtaMinIndex: 4,
      maxCtas: 2,
    },
  },
  {
    id: "local_service",
    label: "Local Service",
    intent: "Local trust + action flow for bookings and calls",
    preferredSectionOrder: ["hero", "trust_strip", "value_props", "stat_band", "cta", "faq", "footer"],
    heroStyle: "location + service hero",
    ctaStrategy: "call/book now",
    visualDensity: "low",
    trustPattern: "reviews + service guarantees",
    bestForIndustries: ["local business", "medical", "home services", "hospitality"],
    enforcement: {
      sectionCountMin: 7,
      sectionCountMax: 10,
      expendableRegistryKeys: ["faq", "visual_break_gradient", "stat_band"],
      trustEarlyMaxIndex: 1,
      firstCtaMinIndex: 3,
      maxCtas: 2,
    },
  },
  {
    id: "premium_minimal",
    label: "Premium Minimal",
    intent: "Minimal luxury composition with restrained, high-clarity sections",
    preferredSectionOrder: ["hero", "paragraph_intro", "value_props", "social_proof", "cta", "footer"],
    heroStyle: "minimal premium",
    ctaStrategy: "single high-intent CTA",
    visualDensity: "low",
    trustPattern: "tight curated proof",
    bestForIndustries: ["luxury", "boutique firms", "executive services"],
    enforcement: {
      sectionCountMin: 5,
      sectionCountMax: 8,
      expendableRegistryKeys: ["faq", "glow_strip", "visual_break_gradient", "stat_band"],
      firstCtaMinIndex: 3,
      maxCtas: 1,
    },
  },
  {
    id: "web3_immersive",
    label: "Web3 Immersive",
    intent: "Protocol-native immersive structure with ecosystem proof",
    preferredSectionOrder: ["hero", "web3_ribbon", "trust_network", "feature_grid", "token_proof", "cta", "faq"],
    heroStyle: "neural/glass web3 hero",
    ctaStrategy: "connect wallet / join allowlist",
    visualDensity: "high",
    trustPattern: "ecosystem + chain signal",
    bestForIndustries: ["web3", "defi", "nft", "on-chain products"],
    enforcement: {
      sectionCountMin: 8,
      sectionCountMax: 12,
      expendableRegistryKeys: ["faq", "visual_break_gradient", "glow_strip"],
      trustEarlyMaxIndex: 3,
      firstCtaMinIndex: 4,
      maxCtas: 2,
    },
  },
];

export function getLayoutFamilyById(id: string | null | undefined): LayoutFamily | undefined {
  if (!id) return undefined;
  return LAYOUT_FAMILIES.find((f) => f.id === id);
}

type InspirationLayoutHint = {
  layoutPatterns?: string[];
  sectionPatterns?: string[];
} | null;

function trustLedInspiration(h: InspirationLayoutHint | undefined): boolean {
  if (!h) return false;
  const blob = [...(h.layoutPatterns ?? []), ...(h.sectionPatterns ?? [])].join(" ").toLowerCase();
  if (!/trust|proof|cred|security|credential/.test(blob)) return false;
  return /(early|first|before|above|near)/.test(blob) || /trust|proof/.test(blob.slice(0, 80));
}

/**
 * Picks a starting layout family from conversational intake + brief signals.
 * When `input` is omitted, behavior matches the legacy seed + inspiration-only heuristics.
 */
export function pickPrimaryLayoutFamily(
  input: SitePlannerInput | undefined,
  inspiration: InspirationLayoutHint | undefined,
): LayoutFamily {
  if (!input) {
    if (trustLedInspiration(inspiration ?? null)) {
      return LAYOUT_FAMILIES.find((f) => f.id === "split_authority") ?? LAYOUT_FAMILIES[0]!;
    }
    return LAYOUT_FAMILIES[0]!;
  }
  const blob = [
    input.userPrompt,
    input.industry,
    input.market,
    input.statedConversionGoal,
    input.statedTrustAndProof,
    input.statedDesignPreference,
    input.statedBrandTone,
    input.primaryOffer,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (input.siteType === "web3_product" || input.web3VisualMode || /\b(web3|wallet|nft|defi|on-?chain|token|dao)\b/.test(blob)) {
    return LAYOUT_FAMILIES.find((f) => f.id === "web3_immersive") ?? LAYOUT_FAMILIES[0]!;
  }
  if (input.siteType === "local_business" || /\b(local|near me|neighborhood|book online|store hours|visit us|restaurant|salon|clinic)\b/.test(blob)) {
    return LAYOUT_FAMILIES.find((f) => f.id === "local_service") ?? LAYOUT_FAMILIES[0]!;
  }
  if (trustLedInspiration(inspiration ?? null) || (input.statedTrustAndProof && input.statedTrustAndProof.trim().length > 20)) {
    return LAYOUT_FAMILIES.find((f) => f.id === "split_authority") ?? LAYOUT_FAMILIES[0]!;
  }
  if (/\b(pricing|subscribe|checkout|tiers|saas|e-?commerce|cart|buy now|get quote)\b/.test(blob)) {
    return LAYOUT_FAMILIES.find((f) => f.id === "conversion_funnel") ?? LAYOUT_FAMILIES[0]!;
  }
  if (/\b(portfolio|editorial|writer|magazine|essay|story)\b/.test(blob)) {
    return LAYOUT_FAMILIES.find((f) => f.id === "editorial_story") ?? LAYOUT_FAMILIES[0]!;
  }
  return LAYOUT_FAMILIES[0]!;
}

export function chooseVariantLayoutFamilies(
  variantCount: number,
  seedHint?: string,
  inspiration?: InspirationLayoutHint,
  input?: SitePlannerInput,
): LayoutFamily[] {
  const n = Math.max(1, Math.min(variantCount, 3));
  const all = [...LAYOUT_FAMILIES];
  const primary = pickPrimaryLayoutFamily(input, inspiration);
  let start = all.findIndex((f) => f.id === primary.id);
  if (start < 0) start = 0;

  if (!input) {
    if (trustLedInspiration(inspiration ?? null)) {
      const idx = all.findIndex((f) => f.id === "split_authority");
      if (idx >= 0) start = idx;
    } else if (seedHint) {
      let h = 0;
      for (let i = 0; i < seedHint.length; i++) h = (h * 33 + seedHint.charCodeAt(i)) >>> 0;
      start = h % all.length;
    }
  }

  const rotated = [...all.slice(start), ...all.slice(0, start)];
  return rotated.slice(0, n);
}
