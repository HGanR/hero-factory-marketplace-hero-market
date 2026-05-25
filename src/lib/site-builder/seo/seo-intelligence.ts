import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Minimal `<head>` tags for isolated preview tab (matches static export signals). */
export function buildPreviewHeadTagsHtml(meta: SiteSchemaDocumentType["metadata"] | undefined): string {
  if (!meta) return "";
  const lines: string[] = [];
  if (meta.title) lines.push(`<title>${escapeAttr(meta.title)}</title>`);
  if (meta.description) lines.push(`<meta name="description" content="${escapeAttr(meta.description)}" />`);
  if (Array.isArray(meta.keywords) && meta.keywords.length) {
    lines.push(`<meta name="keywords" content="${escapeAttr(meta.keywords.join(", "))}" />`);
  }
  if (meta.canonicalUrl) lines.push(`<link rel="canonical" href="${escapeAttr(meta.canonicalUrl)}" />`);
  if (meta.robots) lines.push(`<meta name="robots" content="${escapeAttr(meta.robots)}" />`);
  const og = meta.openGraph;
  if (og?.title) lines.push(`<meta property="og:title" content="${escapeAttr(og.title)}" />`);
  if (og?.description) lines.push(`<meta property="og:description" content="${escapeAttr(og.description)}" />`);
  if (og?.image) lines.push(`<meta property="og:image" content="${escapeAttr(og.image)}" />`);
  if (og?.type) lines.push(`<meta property="og:type" content="${escapeAttr(og.type)}" />`);
  const tw = meta.twitterCard;
  if (tw?.card) lines.push(`<meta name="twitter:card" content="${escapeAttr(tw.card)}" />`);
  if (tw?.title) lines.push(`<meta name="twitter:title" content="${escapeAttr(tw.title)}" />`);
  if (tw?.description) lines.push(`<meta name="twitter:description" content="${escapeAttr(tw.description)}" />`);
  if (Array.isArray(meta.structuredData)) {
    for (const node of meta.structuredData) {
      lines.push(`<script type="application/ld+json">${JSON.stringify(node).replace(/</g, "\\u003c")}</script>`);
    }
  }
  return lines.join("\n  ");
}

export type SeoExtractionInput = SitePlannerInput | { userPrompt: string; businessName?: string; industry?: string; market?: string };

export type SearchIntentType = "transactional" | "informational" | "local";

export type SeoIntent = {
  businessName: string;
  industry: string;
  location: string | null;
  services: string;
  targetAudience: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  intentType: SearchIntentType;
  seoTheme: "local-service" | "b2b-professional" | "web3-protocol" | "saas-product" | "general";
};

export type GeneratedSeoMetadata = {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  robots: string;
  openGraph: {
    title: string;
    description: string;
    image: string;
    type: "website";
  };
  twitterCard: {
    card: "summary_large_image";
    title: string;
    description: string;
  };
};

const PLACEHOLDER_CANONICAL = "https://www.example.com/";
const DEFAULT_OG_IMAGE =
  "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=630&fit=crop&q=80";

function norm(s: string | undefined | null): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function slugifyId(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "section";
}

function clip(s: string, _min: number, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** SERP-friendly band (140–160); expands short value props without repeating the title keyword unnaturally. */
function padMetaDescription(
  base: string,
  ctx: { businessName: string; primaryKeyword: string; location: string | null },
): string {
  let t = base.replace(/\s+/g, " ").trim();
  if (t.length > 160) return clip(t, 140, 160);
  const extras = [
    ` See how ${ctx.businessName} can help with your next step.`,
    ctx.location ? ` Local support in ${ctx.location} and nearby areas.` : "",
    ` Learn more about our approach to ${ctx.primaryKeyword.toLowerCase()}.`,
  ];
  for (const bit of extras) {
    if (!bit || t.length >= 140) break;
    t = `${t}${bit}`.replace(/\s+/g, " ").trim();
  }
  while (t.length < 140) {
    t = `${t} Contact us to get started.`.replace(/\s+/g, " ").trim();
  }
  return clip(t, 140, 160);
}

function guessBusinessName(full: string, input: SeoExtractionInput): string {
  const b = "businessName" in input ? norm(input.businessName) : "";
  if (b) return b.slice(0, 120);
  const forA = full.match(/\bfor a\s+([^.\n]{3,80})/i);
  if (forA?.[1]) return forA[1].trim().replace(/\s+with.*$/i, "").slice(0, 120);
  const m = full.match(/\b(?:for|about)\s+([A-Z][^.,\n]{2,60}?)(?:\s+—|\s+–|\s+-|\s+with|\s+who|\s+that|,|\.|$)/i);
  if (m?.[1]) return m[1].trim().slice(0, 120);
  const quoted = full.match(/"([^"]{2,80})"/);
  if (quoted?.[1]) return quoted[1].trim();
  return "Your business";
}

function guessIndustry(full: string, input: SeoExtractionInput): string {
  const ind = "industry" in input ? norm(input.industry) : "";
  if (ind) return ind.slice(0, 120);
  const pairs: Array<{ re: RegExp; label: string }> = [
    { re: /\b(web3|blockchain|defi|crypto|wallet|token)\b/i, label: "Web3 & blockchain" },
    { re: /\b(tax|cpa|irs|accounting)\b/i, label: "Tax & accounting" },
    { re: /\b(real\s+estate|property|tokenization|reit)\b/i, label: "Real estate" },
    { re: /\b(saas|software|platform|api)\b/i, label: "SaaS" },
    { re: /\b(marketing|seo|growth|agency)\b/i, label: "Marketing" },
    { re: /\b(consult|advisory|advisor)\b/i, label: "Consulting" },
  ];
  for (const { re, label } of pairs) {
    if (re.test(full)) return label;
  }
  return "Professional services";
}

function extractLocation(full: string): string | null {
  const metro =
    full.match(
      /\b(Atlanta|Austin|Boston|Chicago|Dallas|Denver|Houston|Los Angeles|LA|Miami|NYC|New York|Philadelphia|Phoenix|San Diego|San Francisco|Seattle|Portland|London|Berlin|Toronto|Singapore)\b/i,
    )?.[1];
  if (metro) return metro;
  const m = full.match(/\b(?:in|near|serving|based in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  return m?.[1]?.trim() ?? null;
}

function guessServices(full: string, input: SeoExtractionInput): string {
  const offer = "primaryOffer" in input ? norm(input.primaryOffer) : "";
  if (offer) return offer.slice(0, 200);
  const m = full.match(/\b(?:offer|offering|services?|we help|helping)\s+([^.\n]{12,160})/i);
  return (m?.[1] ?? "Professional services and advisory").trim().slice(0, 200);
}

function guessAudience(full: string, input: SeoExtractionInput): string {
  const aud = "audience" in input ? norm(input.audience) : "";
  if (aud) return aud.slice(0, 200);
  const m = full.match(/\b(?:for|targeting|audience)\s+([^.\n]{10,120})/i);
  return (m?.[1] ?? "Business decision-makers").trim().slice(0, 200);
}

function classifyIntent(full: string, location: string | null): SearchIntentType {
  const lower = full.toLowerCase();
  if (location || /\b(near me|local|city|zip|office hours|visit us)\b/i.test(full)) return "local";
  if (/\b(how to|what is|guide|learn|tutorial|resources|blog)\b/i.test(lower)) return "informational";
  return "transactional";
}

function pickSeoTheme(full: string, industry: string): SeoIntent["seoTheme"] {
  if (/\bweb3|blockchain|defi|token|wallet\b/i.test(full)) return "web3-protocol";
  if (/\b(saas|software|platform)\b/i.test(full) || /saas/i.test(industry)) return "saas-product";
  if (/\b(tax|cpa|local business|restaurant|clinic|salon)\b/i.test(full)) return "local-service";
  if (/\b(b2b|enterprise|consult|advisory)\b/i.test(full)) return "b2b-professional";
  return "general";
}

function buildPrimaryKeyword(full: string, location: string | null, industry: string, services: string): string {
  const serviceCore = services.split(/[.–—]/)[0]?.trim() || services.slice(0, 48);
  const tail = industry.split("&")[0]?.trim() || industry;
  if (location) {
    const localKw = `${location} ${tail}`.replace(/\s+/g, " ").trim();
    return clip(localKw, 20, 72);
  }
  const merged = `${serviceCore} ${tail}`.replace(/\s+/g, " ").trim();
  return clip(merged, 20, 72) || clip(full.slice(0, 80), 20, 72);
}

function secondaryFromPrompt(full: string, primary: string): string[] {
  const stop = new Set(
    primary
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
  const words = full
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !stop.has(w));
  const uniq: string[] = [];
  for (const w of words) {
    if (!uniq.includes(w)) uniq.push(w);
    if (uniq.length >= 8) break;
  }
  return uniq;
}

/**
 * Deterministic SEO intent from planner / intake text (no manual SEO fields required).
 */
export function extractSeoIntent(input: SeoExtractionInput): SeoIntent {
  const userPrompt = "userPrompt" in input ? input.userPrompt : "";
  const full = [userPrompt, "industry" in input ? input.industry : "", "market" in input ? input.market : ""]
    .filter(Boolean)
    .join(" \n ");

  const businessName = guessBusinessName(full, input);
  const industry = guessIndustry(full, input);
  const location = extractLocation(full);
  const services = guessServices(full, input);
  const targetAudience = guessAudience(full, input);
  const intentType = classifyIntent(full, location);
  const seoTheme = pickSeoTheme(full, industry);
  const primaryKeyword = buildPrimaryKeyword(full, location, industry, services);
  const secondaryKeywords = secondaryFromPrompt(full, primaryKeyword);

  return {
    businessName,
    industry,
    location,
    services,
    targetAudience,
    primaryKeyword,
    secondaryKeywords,
    intentType,
    seoTheme,
  };
}

export function generateSeoMetadata(seoIntent: SeoIntent): GeneratedSeoMetadata {
  const { businessName, primaryKeyword, secondaryKeywords, services, intentType, location } = seoIntent;
  const kwList = [primaryKeyword, ...secondaryKeywords.slice(0, 6)].filter(Boolean);
  const uniqueKw = [...new Set(kwList.map((k) => k.trim()).filter(Boolean))];

  const titleCore = `${primaryKeyword}`.trim();
  let title = `${titleCore} | ${businessName}`.trim();
  if (title.length > 60) {
    title = `${clip(titleCore, 20, 44)} | ${clip(businessName, 2, 14)}`.trim();
  }
  title = clip(title, 40, 60);

  const cta =
    intentType === "local"
      ? `Book a consultation${location ? ` in ${location}` : ""} or call today.`
      : intentType === "informational"
        ? "Read the guide and subscribe for updates."
        : "Get a free consultation and see how we can help.";
  const descBase = `${clip(services, 40, 120)} ${cta}`.replace(/\s+/g, " ").trim();
  const description = padMetaDescription(descBase, { businessName, primaryKeyword, location });

  const keywords = uniqueKw.slice(0, 12);

  return {
    title,
    description,
    keywords,
    canonicalUrl: PLACEHOLDER_CANONICAL,
    robots: "index, follow",
    openGraph: {
      title,
      description: clip(description, 80, 200),
      image: DEFAULT_OG_IMAGE,
      type: "website",
    },
    twitterCard: {
      card: "summary_large_image",
      title,
      description: clip(description, 80, 200),
    },
  };
}

function buildOrganizationJsonLd(seo: SeoIntent, meta: GeneratedSeoMetadata): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo.businessName,
    url: meta.canonicalUrl,
    logo: meta.openGraph.image,
    sameAs: [] as string[],
  };
}

function buildServiceJsonLd(seo: SeoIntent, meta: GeneratedSeoMetadata): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: seo.primaryKeyword,
    areaServed: seo.location ? { "@type": "AdministrativeArea", name: seo.location } : { "@type": "Country", name: "Worldwide" },
    provider: {
      "@type": "Organization",
      name: seo.businessName,
      url: meta.canonicalUrl,
    },
  };
}

function buildLocalBusinessJsonLd(seo: SeoIntent, meta: GeneratedSeoMetadata): Record<string, unknown> | null {
  if (!seo.location) return null;
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: seo.businessName,
    image: meta.openGraph.image,
    address: {
      "@type": "PostalAddress",
      addressLocality: seo.location,
      addressCountry: "US",
    },
    url: meta.canonicalUrl,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "17:00",
      },
    ],
  };
}

function parseFaqPairs(body: string): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = [];
  const chunks = body.split(/\n\n+/);
  for (const ch of chunks) {
    const m = ch.match(/^Q:\s*([^\n]+)\nA:\s*([\s\S]+)$/im);
    if (m) {
      out.push({ question: m[1]!.trim(), answer: m[2]!.trim().slice(0, 500) });
    }
  }
  return out.slice(0, 12);
}

function buildFaqJsonLdFromBlocks(blocks: SiteSchemaDocumentType["pages"][number]["blocks"]): Record<string, unknown> | null {
  for (const b of blocks) {
    if (b.type !== "section") continue;
    const c = b.content as { aiRegistryKey?: string; body?: string } | undefined;
    if (c?.aiRegistryKey !== "faq" || !c.body) continue;
    const pairs = parseFaqPairs(String(c.body));
    if (!pairs.length) continue;
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: pairs.map((p) => ({
        "@type": "Question",
        name: p.question,
        acceptedAnswer: { "@type": "Answer", text: p.answer },
      })),
    };
  }
  return null;
}

export function buildStructuredDataJsonLd(
  seoIntent: SeoIntent,
  meta: GeneratedSeoMetadata,
  homeBlocks: SiteSchemaDocumentType["pages"][number]["blocks"],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  out.push(buildOrganizationJsonLd(seoIntent, meta));
  out.push(buildServiceJsonLd(seoIntent, meta));
  const local = buildLocalBusinessJsonLd(seoIntent, meta);
  if (local) out.push(local);
  const faq = buildFaqJsonLdFromBlocks(homeBlocks);
  if (faq) out.push(faq);
  return out;
}

export type SeoQualityReport = {
  warnings: string[];
};

export function validateSeoQuality(params: {
  title: string;
  description: string;
  primaryKeyword: string;
  structuredDataCount: number;
  h1Count: number;
}): SeoQualityReport {
  const warnings: string[] = [];
  const { title, description, primaryKeyword, structuredDataCount, h1Count } = params;
  if (title.length < 30) warnings.push("Title is shorter than 30 characters — consider expanding with a benefit.");
  if (title.length > 60) warnings.push("Title exceeds 60 characters — may truncate in search results.");
  if (description.length < 120) warnings.push("Meta description under 120 characters — add a clearer value prop or CTA.");
  if (description.length > 160) warnings.push("Meta description over 160 characters — may truncate in SERPs.");
  const firstTok = primaryKeyword.toLowerCase().split(/\s+/).find(Boolean);
  if (!primaryKeyword || (firstTok && !title.toLowerCase().includes(firstTok))) {
    warnings.push("Primary keyword may be missing from the title — verify intent coverage.");
  }
  if (structuredDataCount < 2) warnings.push("Few structured data graphs — Organization + Service recommended at minimum.");
  if (h1Count !== 1) warnings.push(`Expected exactly one H1 per page; found ${h1Count}.`);
  return { warnings };
}

function countH1InBlocks(blocks: SiteSchemaDocumentType["pages"][number]["blocks"]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.type === "hero") {
      n += 1;
      continue;
    }
    if (b.type === "heading") {
      const lv = String((b.content as { level?: string } | undefined)?.level || "h2").toLowerCase();
      if (lv === "h1") n += 1;
    }
  }
  return n;
}

function ensureKeywordInText(text: string, keyword: string, maxLen: number): string {
  if (!keyword.trim()) return text;
  if (text.toLowerCase().includes(keyword.toLowerCase())) return text;
  const prefix = `${keyword} — `;
  return clip(prefix + text, 20, maxLen);
}

/**
 * Enforces on-page SEO signals on generated blocks (single pass, deterministic).
 */
export function enforceOnPageSeoOnBlocks(
  blocks: SiteSchemaDocumentType["pages"][number]["blocks"],
  seoIntent: SeoIntent,
): void {
  const kw = seoIntent.primaryKeyword;
  let heroSeen = false;

  for (const b of blocks) {
    if (b.type === "hero") {
      heroSeen = true;
      const c = (b.content || {}) as Record<string, unknown>;
      const title = String(c.title ?? "");
      c.title = ensureKeywordInText(title, kw, 200);
      const sub = String(c.subtitle ?? "");
      if (sub && !sub.toLowerCase().includes(kw.toLowerCase())) {
        c.subtitle = clip(`${kw}: ${sub}`, 20, 320);
      }
      c.seoAnchorId = "hero";
      b.content = c;
    }
  }

  const firstPara = blocks.find((b) => b.type === "paragraph");
  if (firstPara) {
    const c = (firstPara.content || {}) as Record<string, unknown>;
    const t = String(c.text ?? "");
    c.text = ensureKeywordInText(t, kw, 600);
    if (!c.seoAnchorId) c.seoAnchorId = slugifyId(String(c.aiSectionId || "intro"));
    firstPara.content = c;
  }

  const firstCta = blocks.find((b) => b.type === "call_to_action");
  if (firstCta) {
    const c = (firstCta.content || {}) as Record<string, unknown>;
    const label = String(c.label ?? "");
    c.label = ensureKeywordInText(label || "Get started", kw, 120);
    const href = String(c.href ?? "#");
    if (href === "#contact" || href === "#") {
      const intro = blocks.find((x) => x.type === "paragraph" && (x.content as { seoAnchorId?: string })?.seoAnchorId);
      const aid = intro ? String((intro.content as { seoAnchorId?: string }).seoAnchorId || "intro") : "intro";
      c.href = `#${aid}`;
    }
    firstCta.content = c;
  }

  for (const b of blocks) {
    const c = (b.content || {}) as Record<string, unknown>;
    if (b.type === "heading") {
      const levelRaw = String(c.level || "h2").toLowerCase();
      if (levelRaw === "h1" && heroSeen) {
        c.level = "h2";
      } else if (!c.level) {
        c.level = "h2";
      }
      b.content = c;
    } else if (b.type === "section") {
      if (!c.seoAnchorId) c.seoAnchorId = slugifyId(String(c.aiSectionId || "section"));
      b.content = c;
    } else if (b.type === "image_grid") {
      const images = Array.isArray(c.images) ? (c.images as Array<{ alt?: string; src?: string }>) : [];
      c.images = images.map((img, i) => ({
        ...img,
        alt: img.alt?.trim()
          ? ensureKeywordInText(String(img.alt), kw, 160)
          : clip(`${kw} — visual ${i + 1}`, 20, 160),
      }));
      b.content = c;
    } else if (b.type === "image") {
      const alt = String(c.alt ?? "");
      c.alt = ensureKeywordInText(alt || `${kw} image`, kw, 180);
      b.content = c;
    }
  }
}

export function buildSeoAssistantSummaryLine(seoIntent: SeoIntent): string {
  return `I've optimized this page for “${seoIntent.primaryKeyword}” with supporting keywords and search structure.`;
}

export function applySeoIntelligenceToDocument(
  doc: SiteSchemaDocumentType,
  plannerInput?: SitePlannerInput | null,
): SiteSchemaDocumentType {
  if (!plannerInput?.userPrompt?.trim()) return doc;
  const seoIntent = extractSeoIntent(plannerInput);
  const gen = generateSeoMetadata(seoIntent);
  const home = doc.pages[0];
  if (home?.blocks) {
    enforceOnPageSeoOnBlocks(home.blocks, seoIntent);
  }

  const structuredData = buildStructuredDataJsonLd(seoIntent, gen, home?.blocks ?? []);

  const prev: Partial<NonNullable<SiteSchemaDocumentType["metadata"]>> = doc.metadata ?? {};
  const m: NonNullable<SiteSchemaDocumentType["metadata"]> = {
    removeDefaultCss: prev.removeDefaultCss ?? false,
    governance: prev.governance ?? {},
    ...prev,
    title: gen.title,
    description: gen.description,
    keywords: gen.keywords,
    canonicalUrl: gen.canonicalUrl,
    robots: gen.robots,
    openGraph: gen.openGraph,
    twitterCard: gen.twitterCard,
    structuredData,
    seoPrimaryKeyword: seoIntent.primaryKeyword,
    seoAssistantSummary: buildSeoAssistantSummaryLine(seoIntent),
  };

  const h1Count = home?.blocks ? countH1InBlocks(home.blocks) : 0;
  const q = validateSeoQuality({
    title: gen.title,
    description: gen.description,
    primaryKeyword: seoIntent.primaryKeyword,
    structuredDataCount: structuredData.length,
    h1Count,
  });
  m.seoQualityWarnings = q.warnings.length ? q.warnings : undefined;

  doc.metadata = m;
  return doc;
}
