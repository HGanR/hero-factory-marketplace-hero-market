/**
 * Bespoke, deterministic section composition: intent + styleMode + brief shape + route role.
 * No UI — used only by the planner / generator.
 */

import type { SectionRole, SiteIntent, SitePlannerInput, SitePlannerOutput } from "@/lib/site-builder/ai/schemas";
import type { LayoutFamily } from "@/lib/site-builder/ai/layout-families";
import { resolveStyleMode, type StyleMode } from "@/lib/site-builder/ai/visual-tokens";
import { getCinematicStylePresetForLayoutFamily } from "@/lib/site-builder/ai/cinematic-styles";
import { getLayoutFamilyById } from "@/lib/site-builder/ai/layout-families";

export type ComposedSectionRow = {
  id: string;
  registryKey: string;
  headline?: string;
  purpose?: string;
  rhythmSurface?: "light" | "dark" | "visual";
  spacingScale?: "tight" | "balanced" | "spacious";
  sectionRole?: SectionRole;
};

/** Map registry keys to funnel roles (used by planner + differentiation). */
export function inferSectionRoleForRegistryKey(registryKey: string): SectionRole {
  if (/^hero_/.test(registryKey) || registryKey === "hero_primary") return "hero";
  if (registryKey === "footer_standard") return "conversion";
  if (["mid_cta", "cta_glow_panel", "pricing_cinematic_cards"].includes(registryKey)) return "conversion";
  if (["trust_strip", "trust_network_grid", "web3_ribbon"].includes(registryKey)) return "trust";
  if (["social_proof", "web3_proof_network", "stat_band"].includes(registryKey)) return "proof";
  return "narrative";
}

function isConversionRegistryKey(k: string): boolean {
  return k === "mid_cta" || k === "cta_glow_panel" || k === "pricing_cinematic_cards";
}

function enforceTrustEarlyRow(rows: ComposedSectionRow[], family: LayoutFamily): ComposedSectionRow[] {
  const maxIdx = family.enforcement.trustEarlyMaxIndex;
  if (maxIdx === undefined) return rows;
  const trustKeys = new Set(["trust_strip", "trust_network_grid"]);
  const r = [...rows];
  let tidx = r.findIndex((x) => trustKeys.has(x.registryKey));
  if (tidx < 0) {
    r.splice(1, 0, { ...TRUST, id: `sec_trust_enforced_${briefFingerprint(family.id)}` });
    tidx = 1;
  }
  if (tidx > maxIdx) {
    const row = r.splice(tidx, 1)[0];
    const insertAt = Math.max(1, Math.min(maxIdx, r.length - 1));
    r.splice(insertAt, 0, row!);
  }
  return r;
}

function enforceCtaRhythm(rows: ComposedSectionRow[], family: LayoutFamily): ComposedSectionRow[] {
  const minIdx = family.enforcement.firstCtaMinIndex ?? 2;
  const maxCtas = family.enforcement.maxCtas ?? 2;
  const r = [...rows];
  while (true) {
    const i = r.findIndex((x, idx) => idx > 0 && isConversionRegistryKey(x.registryKey));
    if (i < 0 || i >= minIdx) break;
    if (i < r.length - 2 && r[i + 1]!.registryKey !== "footer_standard") {
      const a = r[i]!;
      r[i] = r[i + 1]!;
      r[i + 1] = a;
    } else {
      break;
    }
  }
  let ctaCount = r.filter((x) => isConversionRegistryKey(x.registryKey)).length;
  if (ctaCount <= maxCtas) return r;
  let over = ctaCount - maxCtas;
  for (let i = r.length - 2; i >= 1 && over > 0; i--) {
    if (isConversionRegistryKey(r[i]!.registryKey)) {
      r.splice(i, 1);
      over--;
      ctaCount--;
    }
  }
  return r;
}

/**
 * When `layoutFamilyId` is set on the request, replace planner `sectionPlan` with the strict
 * deterministic family composition (LLM order cannot override structure).
 */
export function applyStrictLayoutFamilyToPlanner(planner: SitePlannerOutput, input: SitePlannerInput): boolean {
  const fid = input.layoutFamilyId?.trim();
  if (!fid || !getLayoutFamilyById(fid)) return false;
  const styleMode =
    planner.designTokens.styleMode ??
    resolveStyleMode({
      designDirection: input.designDirection,
      web3VisualMode: input.web3VisualMode,
      intent: planner.intent,
    });
  const rows = composeHomeSectionPlan(
    planner.intent,
    styleMode,
    input.web3VisualMode,
    planner.normalizedBrief,
    Math.max(0, Math.min(7, input.layoutVariantIndex ?? 0)),
    fid,
  );
  planner.sectionPlan = rows.map((s) => ({
    id: s.id,
    registryKey: s.registryKey,
    headline: s.headline,
    purpose: s.purpose,
    rhythmSurface: s.rhythmSurface,
    spacingScale: s.spacingScale,
    sectionRole: s.sectionRole,
  }));
  return true;
}

/** Assign funnel roles to any planner rows missing `sectionRole`. */
export function stampSectionRolesOnPlanner(planner: SitePlannerOutput): void {
  planner.sectionPlan = planner.sectionPlan.map((row) => ({
    ...row,
    sectionRole: row.sectionRole ?? inferSectionRoleForRegistryKey(row.registryKey),
  }));
}

export function briefFingerprint(brief: string): number {
  let h = 2166136261;
  for (let i = 0; i < brief.length; i++) {
    h ^= brief.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickIdx(mod: number, len: number): number {
  if (len <= 0) return 0;
  return mod % len;
}

function row(id: string, registryKey: string, headline?: string, purpose?: string): ComposedSectionRow {
  return headline || purpose ? { id, registryKey, headline, purpose } : { id, registryKey };
}

const TRUST = row("sec_trust", "trust_strip", undefined, "Credibility strip");
const INTRO = row("sec_intro", "paragraph_intro", undefined, "Narrative framing");
const STATS = row("sec_stats", "stat_band", undefined, "Proof metrics");
const VALUES = row("sec_values", "value_props", undefined, "Value props");
const FEATURES = row("sec_features", "feature_grid", undefined, "Capability grid");
const BREAK = row("sec_break", "visual_break_gradient", undefined, "Visual rhythm");
const CTA = row("sec_cta", "mid_cta", undefined, "Primary conversion");
const PROOF = row("sec_proof", "social_proof", undefined, "Trust note");
const GLOW = row("sec_glow", "glow_strip", undefined, "Accent band");
const FAQ = row("sec_faq", "faq", undefined, "FAQ");
const FOOT = row("sec_foot", "footer_standard", undefined, "Footer");
const WEB3_RIB = row("sec_web3", "web3_ribbon", "Web3", "Protocol / chain emphasis");

function isEditorialBrief(brief: string): boolean {
  return /\b(stor(y|ies)|editorial|magazine|essay|writer|narrative|journalism|blog|long-?form)\b/i.test(brief);
}

function heroRegistryKey(intent: SiteIntent, styleMode: StyleMode, web3: boolean, v: number): string {
  if (web3 || intent === "web3_product") return "hero_primary_neural";
  if (intent === "portfolio") return "hero_primary_holographic";
  if (intent === "local_business") return "hero_primary_grid";
  if (intent === "trust_operator") return "hero_primary_glow";
  if (styleMode === "minimal") return "hero_primary_split";
  if (styleMode === "bold") {
    return pickIdx(v, 2) === 0 ? "hero_primary_signal" : "hero_primary_depth";
  }
  if (intent === "saas") return pickIdx(v, 2) === 0 ? "hero_primary_split" : "hero_primary_glow";
  if (intent === "ecommerce_light") return pickIdx(v, 2) === 0 ? "hero_primary_grid" : "hero_primary_split";
  if (intent === "community") return "hero_primary_glow";
  return pickIdx(v, 2) === 0 ? "hero_primary_glow" : "hero_primary_split";
}

function heroHeadline(intent: SiteIntent, styleMode: StyleMode): string | undefined {
  if (intent === "portfolio") return "Portfolio hero";
  if (intent === "local_business") return "Local hero";
  if (intent === "web3_product" || styleMode === "web3") return "Launch surface";
  if (intent === "saas") return "Product hero";
  if (intent === "trust_operator") return "Fiduciary hero";
  if (intent === "ecommerce_light") return "Offer hero";
  if (styleMode === "bold") return "Bold opener";
  if (styleMode === "minimal") return "Focused hero";
  return "Primary hero";
}

function heroPurpose(intent: SiteIntent): string | undefined {
  const m: Partial<Record<SiteIntent, string>> = {
    saas: "Capability-led opener with proof path",
    ecommerce_light: "Offer-led opener",
    local_business: "Visit / call-forward opener",
    trust_operator: "Governance-clear opener",
    web3_product: "Signal-forward launch hero",
    community: "Inclusive membership opener",
    portfolio: "Craft-forward opener",
  };
  return m[intent];
}

/** Reorder [STATS, VALUES, FEATURES] for diversity. */
function metricsCluster(v: number): [ComposedSectionRow, ComposedSectionRow, ComposedSectionRow] {
  const orders: Array<[ComposedSectionRow, ComposedSectionRow, ComposedSectionRow]> = [
    [STATS, VALUES, FEATURES],
    [VALUES, STATS, FEATURES],
    [FEATURES, VALUES, STATS],
  ];
  return orders[pickIdx(v, 3)]!;
}

/**
 * Home page section plan — varies by intent, styleMode, brief (fingerprint), web3 flag, and layout variant.
 */
export function composeHomeSectionPlan(
  intent: SiteIntent,
  styleMode: StyleMode,
  web3VisualMode: boolean,
  brief: string,
  layoutVariantIndex = 0,
  layoutFamilyId?: string,
): ComposedSectionRow[] {
  const familySalt = briefFingerprint(layoutFamilyId ?? "");
  const v = (briefFingerprint(brief) + Math.imul(layoutVariantIndex, 0x9e3779b9) + familySalt) >>> 0;
  const web3 = web3VisualMode || intent === "web3_product";
  const editorial = isEditorialBrief(brief);
  const family = getLayoutFamilyById(layoutFamilyId);
  const hk = heroRegistryKey(intent, styleMode, web3, v);
  const out: ComposedSectionRow[] = [
    row("sec_hero", hk, heroHeadline(intent, styleMode), heroPurpose(intent)),
  ];

  if (family) {
    const ff = composeFamilyDrivenPlan({
      family,
      heroKey: hk,
      v,
      web3,
      intent,
    });
    if (ff.length > 0) {
      return capPlanForLayoutFamily(ff, family, layoutFamilyId ?? family.id);
    }
  }

  if (web3) {
    out.push(WEB3_RIB);
  }

  const [a, b, c] = metricsCluster(v);

  if (editorial || (styleMode === "minimal" && intent === "landing")) {
    out.push(INTRO, TRUST);
    out.push(pickIdx(v, 2) === 0 ? FEATURES : VALUES);
    out.push(BREAK, CTA);
    if (pickIdx(v + 1, 2) === 0) out.push(PROOF);
    out.push(FOOT);
    return capPlan(out, styleMode, 11, layoutFamilyId);
  }

  if (styleMode === "minimal") {
    out.push(TRUST, INTRO, pickIdx(v, 2) === 0 ? VALUES : STATS);
    out.push(FEATURES);
    out.push(CTA);
    if (intent !== "local_business" && pickIdx(v, 3) !== 0) out.push(FAQ);
    out.push(FOOT);
    return capPlan(out, styleMode, 10, layoutFamilyId);
  }

  if (styleMode === "bold") {
    out.push(TRUST, INTRO, a, BREAK);
    out.push(CTA);
    out.push(b, PROOF, c);
    out.push(GLOW);
    if (intent === "saas" || intent === "ecommerce_light") out.push(FAQ);
    else if (pickIdx(v + 2, 2) === 0) out.push(FAQ);
    out.push(FOOT);
    return capPlan(out, styleMode, 14, layoutFamilyId);
  }

  if (styleMode === "web3") {
    out.push(TRUST, STATS, INTRO, VALUES, FEATURES, BREAK, CTA, PROOF, GLOW);
    if (pickIdx(v, 2) === 0) out.push(FAQ);
    out.push(FOOT);
    return capPlan(out, styleMode, 14, layoutFamilyId);
  }

  // corporate + default landing shapes
  if (intent === "trust_operator") {
    out.push(TRUST, INTRO, STATS, VALUES, FEATURES, BREAK, CTA, PROOF, FAQ, FOOT);
    return capPlan(out, styleMode, 14, layoutFamilyId);
  }

  if (intent === "local_business") {
    out.push(TRUST, INTRO, VALUES, STATS, CTA, GLOW, FOOT);
    return capPlan(out, styleMode, 12, layoutFamilyId);
  }

  if (intent === "portfolio") {
    out.push(INTRO, STATS, FEATURES, BREAK, CTA, pickIdx(v, 2) === 0 ? FAQ : PROOF, FOOT);
    return capPlan(out, styleMode, 12, layoutFamilyId);
  }

  if (intent === "ecommerce_light") {
    out.push(TRUST, VALUES, STATS, FEATURES, CTA, PROOF, FAQ, FOOT);
    return capPlan(out, styleMode, 13, layoutFamilyId);
  }

  if (intent === "saas") {
    out.push(TRUST, INTRO, a, b, BREAK, CTA, c, PROOF, FAQ, FOOT);
    return capPlan(out, styleMode, 14, layoutFamilyId);
  }

  if (intent === "community") {
    out.push(INTRO, TRUST, VALUES, FEATURES, BREAK, CTA, PROOF, pickIdx(v, 2) === 0 ? FAQ : GLOW, FOOT);
    return capPlan(out, styleMode, 13, layoutFamilyId);
  }

  // generic landing
  out.push(TRUST, INTRO, a, b, BREAK, CTA, c, PROOF, GLOW, FAQ, FOOT);
  return capPlan(out, styleMode, 14, layoutFamilyId);
}

function composeFamilyDrivenPlan(args: {
  family: LayoutFamily;
  heroKey: string;
  v: number;
  web3: boolean;
  intent: SiteIntent;
}): ComposedSectionRow[] {
  const hero = row(
    "sec_hero",
    args.heroKey,
    heroHeadline(args.intent, args.web3 ? "web3" : "corporate"),
    heroPurpose(args.intent),
  );
  const mapToken = (token: string): ComposedSectionRow | null => {
    switch (token) {
      case "hero":
        return hero;
      case "intro":
      case "paragraph_intro":
        return INTRO;
      case "trust":
      case "trust_strip":
        return TRUST;
      case "trust_network":
        return row("sec_trust_network", "trust_network_grid", undefined, "Network proof");
      case "token_proof":
        return row("sec_token_proof", "web3_proof_network", undefined, "Protocol proof");
      case "services":
      case "value_props":
        return VALUES;
      case "feature_grid":
        return pickIdx(args.v, 2) === 0 ? FEATURES : row("sec_features_bento", "feature_bento_glass", undefined, "Capability grid");
      case "proof":
      case "social_proof":
        return PROOF;
      case "pricing":
        return row("sec_pricing", "pricing_cinematic_cards", undefined, "Pricing");
      case "visual_break":
        return BREAK;
      case "cta":
        return pickIdx(args.v + 3, 2) === 0 ? CTA : row("sec_cta_panel", "cta_glow_panel", undefined, "Primary conversion");
      case "faq":
        return FAQ;
      case "footer":
        return FOOT;
      case "web3_ribbon":
        return WEB3_RIB;
      default:
        return null;
    }
  };

  const out: ComposedSectionRow[] = [];
  for (const token of args.family.preferredSectionOrder) {
    if (token === "stat_band") {
      out.push(STATS);
      continue;
    }
    const r = mapToken(token);
    if (r) out.push(r);
  }
  if (args.web3 && !out.some((r) => r.registryKey === "web3_ribbon")) out.splice(1, 0, WEB3_RIB);
  if (!out.some((r) => r.registryKey === "footer_standard")) out.push(FOOT);
  return out;
}

function applySectionRhythmRows(rows: ComposedSectionRow[], layoutFamilyId?: string): ComposedSectionRow[] {
  const preset = getCinematicStylePresetForLayoutFamily(layoutFamilyId);
  const salt = layoutFamilyId ? briefFingerprint(layoutFamilyId) : 0;
  const surfaces = ["light", "dark", "visual"] as const;
  const spacingCycle: Array<"tight" | "balanced" | "spacious"> = preset
    ? preset.sectionSpacing === "tight"
      ? ["tight", "balanced", "tight", "balanced"]
      : preset.sectionSpacing === "spacious"
        ? ["spacious", "balanced", "spacious", "balanced"]
        : ["balanced", "tight", "balanced", "spacious"]
    : ["balanced", "balanced", "balanced", "balanced"];
  return rows.map((row, i) => ({
    ...row,
    rhythmSurface: surfaces[(i + salt) % surfaces.length],
    spacingScale: spacingCycle[(i + (preset ? 1 : 0)) % spacingCycle.length],
  }));
}

function capPlanForLayoutFamily(rows: ComposedSectionRow[], family: LayoutFamily, layoutFamilyId: string): ComposedSectionRow[] {
  const min = family.enforcement.sectionCountMin;
  const max = family.enforcement.sectionCountMax;
  const expendableKeys = new Set(family.enforcement.expendableRegistryKeys);
  let r = [...rows];
  while (r.length > max) {
    const dropAt = r.findIndex(
      (x, i) => i > 0 && i < r.length - 1 && x.registryKey !== "footer_standard" && expendableKeys.has(x.registryKey),
    );
    if (dropAt === -1) break;
    r.splice(dropAt, 1);
  }
  while (r.length < min) {
    if (!r.some((x) => x.registryKey === "visual_break_gradient")) {
      r.splice(r.length - 1, 0, { ...BREAK, id: `sec_break_pad_${r.length}` });
    } else if (!r.some((x) => x.registryKey === "faq")) {
      r.splice(r.length - 1, 0, { ...FAQ, id: `sec_faq_pad_${r.length}` });
    } else {
      break;
    }
  }
  r = enforceTrustEarlyRow(r, family);
  r = enforceCtaRhythm(r, family);
  return applySectionRhythmRows(
    r.map((row) => ({ ...row, sectionRole: inferSectionRoleForRegistryKey(row.registryKey) })),
    layoutFamilyId,
  );
}

function capPlan(rows: ComposedSectionRow[], styleMode: StyleMode, max: number, layoutFamilyId?: string): ComposedSectionRow[] {
  const min = styleMode === "minimal" ? 6 : 8;
  const r = [...rows];
  const expendableKeys = new Set(["glow_strip", "faq", "visual_break_gradient", "social_proof"]);
  while (r.length > max) {
    const dropAt = r.findIndex(
      (x, i) => i > 0 && i < r.length - 1 && x.registryKey !== "footer_standard" && expendableKeys.has(x.registryKey),
    );
    if (dropAt === -1) break;
    r.splice(dropAt, 1);
  }
  while (r.length < min) {
    if (!r.some((x) => x.registryKey === "visual_break_gradient")) {
      r.splice(r.length - 1, 0, BREAK);
    } else {
      break;
    }
  }
  return applySectionRhythmRows(
    r.map((row) => ({ ...row, sectionRole: inferSectionRoleForRegistryKey(row.registryKey) })),
    layoutFamilyId,
  );
}

/** Extra routes when brief (or intent) implies them — deterministic, capped. */
export function composeSitemap(titleGuess: string, intent: SiteIntent, brief: string): SitePlannerOutput["sitemap"] {
  const home = {
    slug: "/",
    title: titleGuess || "Home",
    purpose: "Primary landing",
  };
  const fp = briefFingerprint(brief);
  const b = brief.toLowerCase();

  const candidates: SitePlannerOutput["sitemap"] = [];

  const wantAbout =
    /\b(about|our story|team|mission|who we are|background)\b/i.test(brief) ||
    intent === "portfolio" ||
    intent === "trust_operator";
  const wantContact =
    /\b(contact|visit us|hours|location|address|book|appointment|call us|get in touch)\b/i.test(brief) ||
    intent === "local_business";
  const wantOffer =
    /\b(pricing|plans|buy now|subscribe|sign\s*up|offer|packages|checkout)\b/i.test(brief) ||
    intent === "ecommerce_light" ||
    intent === "saas";

  if (wantAbout && (intent === "portfolio" || intent === "trust_operator" || pickIdx(fp, 2) === 0)) {
    candidates.push({ slug: "/about", title: "About", purpose: "Story, team, and positioning" });
  }
  if (wantContact && (intent === "local_business" || pickIdx(fp + 1, 3) !== 2)) {
    candidates.push({ slug: "/contact", title: "Contact", purpose: "Reach, hours, and booking" });
  }
  if (wantOffer && (pickIdx(fp + 3, 2) === 0 || intent === "ecommerce_light")) {
    candidates.push({ slug: "/offer", title: "Offer", purpose: "Plans and primary conversion" });
  }

  const sorted = [...candidates].sort((x, y) => x.slug.localeCompare(y.slug));
  const maxExtra = brief.length < 28 && !wantAbout && !wantContact ? 0 : pickIdx(fp + 7, 2) + 1;
  return [home, ...sorted.slice(0, Math.min(3, maxExtra))];
}

export function composeAuxiliaryPagePlan(
  slug: string,
  purpose: string,
  planner: SitePlannerOutput,
  styleMode: StyleMode,
  seed: string,
): ComposedSectionRow[] {
  const v = briefFingerprint(`${planner.normalizedBrief}::${slug}::${seed}`);
  const heroAux = (): string => {
    if (styleMode === "minimal") return "hero_primary_split";
    if (slug === "/contact") return "hero_primary_grid";
    if (slug === "/offer") return "hero_primary_glow";
    return pickIdx(v, 2) === 0 ? "hero_primary_split" : "hero_primary_glow";
  };

  const h = heroAux();
  const safe = slug.replace(/^\//, "").replace(/\//g, "-") || "page";

  if (slug === "/about") {
    return [
      row(`${safe}_hero`, h, "About", purpose.slice(0, 120)),
      row(`${safe}_intro`, "paragraph_intro", undefined, "Narrative"),
      row(`${safe}_trust`, "trust_strip", undefined, "Credibility"),
      ...(pickIdx(v, 2) === 0 ? [row(`${safe}_stats`, "stat_band", undefined, "Highlights")] : []),
      row(`${safe}_values`, "value_props", undefined, "Principles / services"),
      row(`${safe}_cta`, "mid_cta", undefined, "Next step"),
      row(`${safe}_foot`, "footer_standard", undefined, "Footer"),
    ];
  }

  if (slug === "/contact") {
    return [
      row(`${safe}_hero`, h, "Contact", "Reach the team"),
      row(`${safe}_intro`, "paragraph_intro", undefined, "Visit & hours"),
      row(`${safe}_info`, "value_props", undefined, "Location & details"),
      row(`${safe}_cta`, "mid_cta", undefined, "Book or call"),
      row(`${safe}_foot`, "footer_standard", undefined, "Footer"),
    ];
  }

  if (slug === "/offer") {
    return [
      row(`${safe}_hero`, h, "Offer", "Plans & pricing"),
      row(`${safe}_values`, "value_props", undefined, "Packages"),
      row(`${safe}_stats`, "stat_band", undefined, "Outcomes"),
      row(`${safe}_feat`, "feature_grid", undefined, "What's included"),
      row(`${safe}_proof`, "social_proof", undefined, "Customers"),
      row(`${safe}_faq`, "faq", undefined, "FAQ"),
      row(`${safe}_cta`, "mid_cta", undefined, "Get started"),
      row(`${safe}_foot`, "footer_standard", undefined, "Footer"),
    ];
  }

  return [
    row(`${safe}_hero`, h, "Page", purpose.slice(0, 80)),
    row(`${safe}_intro`, "paragraph_intro"),
    row(`${safe}_cta`, "mid_cta"),
    row(`${safe}_foot`, "footer_standard"),
  ];
}
