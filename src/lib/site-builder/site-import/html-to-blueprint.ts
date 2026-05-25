import { load } from "cheerio";
import type { ImportBlueprint, ImportNavItem, ImportSection } from "@/lib/site-builder/site-import/import-blueprint";
import { ImportBlueprintSchema } from "@/lib/site-builder/site-import/import-blueprint";
import { sourceDomainFromUrl } from "@/lib/site-builder/site-import/fetch-remote-html";

const ROUTE_HINTS: ReadonlyArray<{ re: RegExp; family: ImportNavItem["routeFamily"] }> = [
  { re: /^(?:\/|\/index\.html?)$/i, family: "home" },
  { re: /about|team|company|who-we/i, family: "about" },
  { re: /service|solution|pricing|plan|product/i, family: "services" },
  { re: /contact|book|schedule|call/i, family: "contact" },
  { re: /faq|help|support/i, family: "faq" },
  { re: /blog|news|article/i, family: "blog" },
];

function inferRouteFamily(href: string, text: string): ImportNavItem["routeFamily"] | undefined {
  const h = `${href} ${text}`.toLowerCase();
  for (const { re, family } of ROUTE_HINTS) {
    if (re.test(h)) return family;
  }
  return "other";
}

function absolutizeUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function normalizePathForQueue(href: string, baseUrl: string): string | null {
  try {
    const u = new URL(href, baseUrl);
    const b = new URL(baseUrl);
    if (u.hostname !== b.hostname) return null;
    let p = u.pathname || "/";
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    if (p === "" || p === "/index.html" || p === "/index") return "/";
    return p.startsWith("/") ? p : `/${p}`;
  } catch {
    return null;
  }
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function extractUrlsFromCss(style: string): string[] {
  const out: string[] = [];
  const re = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(style)) !== null) {
    const u = m[1]?.trim();
    if (u && !u.startsWith("data:") && !u.startsWith("#")) out.push(u.slice(0, 2000));
  }
  return out;
}

function extractColors($: ReturnType<typeof load>, baseUrl: string): string[] {
  const colors = new Set<string>();
  $("[style*='color'], [style*='background']").each((_, el) => {
    const st = $(el).attr("style") || "";
    const m = st.match(/#([0-9a-f]{3,8})\b|rgb\([^)]+\)|rgba\([^)]+\)/gi);
    m?.forEach((c) => colors.add(c.slice(0, 80)));
  });
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/google.*fonts|typekit/i.test(href)) return;
  });
  $("link[href*='fonts.googleapis.com']").each((_, el) => {
    const href = absolutizeUrl(baseUrl, $(el).attr("href") || "");
    if (href.includes("family=")) {
      const fam = decodeURIComponent(href.split("family=")[1]?.split("&")[0] || "").replace(/\+/g, " ");
      if (fam) colors.add(`font:${fam.slice(0, 60)}`);
    }
  });
  return [...colors].slice(0, 24);
}

function extractFontHints($: ReturnType<typeof load>, baseUrl: string): string[] {
  const fonts = new Set<string>();
  $("link[href*='fonts.googleapis.com']").each((_, el) => {
    const href = $(el).attr("href") || "";
    const m = href.match(/family=([^&]+)/);
    if (m) fonts.add(decodeURIComponent(m[1]!).replace(/\+/g, " ").split(":")[0]!.trim());
  });
  return [...fonts].slice(0, 12);
}

export function htmlToImportBlueprint(html: string, sourceUrl: string, finalUrl?: string): ImportBlueprint {
  const notes: string[] = [];
  const $ = load(html);
  const base = finalUrl || sourceUrl;

  $("script, noscript, style, svg").remove();

  const title = cleanText($("title").first().text());
  const metaDescription = cleanText($('meta[name="description"]').attr("content") || "");
  const ogTitle = cleanText($('meta[property="og:title"]').attr("content") || "");
  const ogImage = cleanText($('meta[property="og:image"]').attr("content") || "");
  const lang = ($("html").attr("lang") || "").trim().slice(0, 16) || undefined;

  const navItems: ImportNavItem[] = [];
  $("nav a[href], header a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    const text = cleanText($(el).text());
    if (!text && !href) return;
    const abs = absolutizeUrl(base, href);
    navItems.push({
      href: abs,
      text: text || href,
      routeFamily: inferRouteFamily(href, text),
    });
  });

  const footerLinks: ImportNavItem[] = [];
  $("footer a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    const text = cleanText($(el).text());
    footerLinks.push({
      href: absolutizeUrl(base, href),
      text: text || href,
      routeFamily: inferRouteFamily(href, text),
    });
  });

  const queued = new Set<string>();
  for (const n of [...navItems, ...footerLinks]) {
    const p = normalizePathForQueue(n.href, base);
    if (p && p !== "/") queued.add(p);
  }
  const queuedRoutes = [...queued].slice(0, 12);

  const sections: ImportSection[] = [];
  let secIdx = 0;

  const h1 = $("h1").first();
  const roleHeading = $('[role="heading"]').first();
  const firstHeadingEl = h1.length ? h1 : roleHeading.length ? roleHeading : $("main h2, body h2, h2, h3").first();

  if (firstHeadingEl.length) {
    const tag = firstHeadingEl.prop("tagName")?.toLowerCase() || "";
    const t = cleanText(firstHeadingEl.text());
    const sub = cleanText(firstHeadingEl.closest("section, article, main, body").find("p").first().text()).slice(0, 600);
    if (t) {
      const isLikelyHero = tag === "h1" || roleHeading.length > 0 || firstHeadingEl.closest("header, [class*='hero'], [id*='hero']").length > 0;
      sections.push({
        id: `import-sec-${secIdx++}`,
        kind: isLikelyHero ? "hero" : "content",
        heading: t.slice(0, 500),
        bodyText: sub || undefined,
        confidence: isLikelyHero ? 0.72 : 0.5,
      });
    }
  }

  $("main h2, body h2").each((_, el) => {
    const heading = cleanText($(el).text());
    if (!heading || heading.length < 2) return;
    if (firstHeadingEl.length && el === firstHeadingEl.get(0)) return;
    let body = "";
    let n = $(el).next();
    let steps = 0;
    while (n.length && steps < 12) {
      const tag = n.prop("tagName")?.toLowerCase() || "";
      if (/^h[1-6]$/.test(tag)) break;
      if (tag === "p" || tag === "div" || tag === "li") {
        body += ` ${cleanText(n.text())}`;
      }
      n = n.next();
      steps++;
    }
    body = cleanText(body).slice(0, 8000);
    sections.push({
      id: `import-sec-${secIdx++}`,
      kind: "content",
      heading: heading.slice(0, 500),
      bodyText: body || undefined,
      confidence: 0.55,
    });
  });

  if (ogImage) {
    sections.push({
      id: `import-sec-${secIdx++}`,
      kind: "media",
      heading: title ? `${title} — social preview` : "Social preview image",
      imageUrls: [absolutizeUrl(base, ogImage)],
      confidence: 0.45,
      imageRole: "hero_candidate",
      fromOpenGraph: true,
    });
    notes.push("Included og:image as a media hint (may be hotlinked in preview).");
  }

  let bgExtracted = 0;
  $("[style*='background']").each((_, el) => {
    if (bgExtracted >= 12) return false;
    const st = ($(el).attr("style") || "").trim();
    if (!/url\(/i.test(st)) return;
    for (const raw of extractUrlsFromCss(st)) {
      if (bgExtracted >= 12) return false;
      const abs = absolutizeUrl(base, raw);
      if (!/^https?:\/\//i.test(abs)) continue;
      bgExtracted += 1;
      const inHeroish = $(el).closest("[class*='hero'],[id*='hero'],header,main").length > 0;
      sections.push({
        id: `import-sec-${secIdx++}`,
        kind: "media",
        heading: "Background image",
        imageUrls: [abs],
        confidence: 0.32,
        imageRole: inHeroish ? "hero_candidate" : "decorative",
        fromCssBackground: true,
      });
    }
  });
  if (bgExtracted) notes.push(`Extracted ${bgExtracted} CSS background image URL(s) — many are decorative.`);

  let imgCount = 0;
  $("main img[src], body img[src], picture img[src]").each((_, el) => {
    if (imgCount >= 20) return false;
    imgCount += 1;
    const src = ($(el).attr("src") || "").trim();
    if (!src || src.startsWith("data:")) return;
    const alt = cleanText($(el).attr("alt") || "");
    const abs = absolutizeUrl(base, src);
    const cls = ($(el).attr("class") || "").toLowerCase();
    const lower = `${alt} ${src} ${cls}`;
    let imageRole: NonNullable<ImportSection["imageRole"]> =
      imgCount <= 2 && $(el).closest("main, article, header, [class*='hero'], [id*='hero']").length > 0 ? "hero_candidate" : "section";
    if (/logo|brand|favicon|mark/i.test(lower)) imageRole = "logo";
    if (/icon-facebook|icon-x|twitter|instagram|linkedin|social/i.test(lower)) imageRole = "social";
    if (/spacer|pixel|1x1|blank|tracking/i.test(lower)) imageRole = "decorative";
    sections.push({
      id: `import-sec-${secIdx++}`,
      kind: "media",
      heading: alt || "Image",
      imageUrls: [abs],
      confidence: 0.4,
      imageRole,
    });
  });

  /** Prominent in-flow CTAs (anchors with real hrefs) — buttons without a resolvable URL are skipped. */
  let ctaAdded = 0;
  const ctaLike = $("main a[href], article a[href], body a[href]").filter((_, el) => {
    const $el = $(el);
    const href = ($el.attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return false;
    const t = cleanText($el.text());
    if (t.length > 80) return false;
    return /\b(get started|contact|sign up|signup|learn more|book|request|demo|try|buy|subscribe)\b/i.test(t);
  });
  ctaLike.each((_, el) => {
    if (ctaAdded >= 4) return false;
    const href = ($(el).attr("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    const text = cleanText($(el).text()) || "Learn more";
    sections.push({
      id: `import-sec-${secIdx++}`,
      kind: "cta",
      linkHref: absolutizeUrl(base, href),
      linkLabel: text.slice(0, 120),
      heading: text.slice(0, 200),
      confidence: 0.42,
    });
    ctaAdded += 1;
  });
  if (ctaAdded) notes.push(`Detected ${ctaAdded} in-page CTA candidate(s) from links/buttons.`);

  if (sections.length === 0) {
    const fallback = cleanText($("main, article, body").first().text()).slice(0, 9000);
    const metaFallback = [title, metaDescription].filter(Boolean).join("\n\n").trim();
    if (fallback.length > 40) {
      sections.push({
        id: "import-sec-0",
        kind: "content",
        heading: title || "Imported page",
        bodyText: fallback,
        confidence: 0.35,
      });
      notes.push("Used body text fallback — structure was not clear.");
    } else if (metaFallback.length > 12) {
      sections.push({
        id: "import-sec-0",
        kind: "content",
        heading: title || "Imported page",
        bodyText: metaFallback.slice(0, 8000),
        confidence: 0.3,
      });
      notes.push("Used title and meta description only — page body had little static text (often SPA or gated content).");
    } else {
      notes.push("Very little readable content — site may be script-rendered, blocked, or require authentication.");
    }
  }

  const logo =
    $('header img[alt*="logo" i], .logo img[src], a.logo img[src]').first().attr("src") ||
    $('link[rel="icon"], link[rel="shortcut icon"]').first().attr("href");
  const logoUrl = logo ? absolutizeUrl(base, logo) : undefined;

  const brand = {
    colors: extractColors($, base),
    fontFamilies: extractFontHints($, base),
    logoUrl,
  };

  const partial =
    notes.length > 0 ||
    sections.filter((s) => (s.confidence ?? 1) < 0.45).length > sections.length / 2 ||
    !title;

  if (!sourceDomainFromUrl(base)) {
    notes.push("Check source URL — hostname could not be derived.");
  }

  return ImportBlueprintSchema.parse({
    version: 1,
    sourceUrl,
    finalUrl: finalUrl || sourceUrl,
    title: title || undefined,
    ogTitle: ogTitle || undefined,
    metaDescription: metaDescription || undefined,
    lang,
    nav: navItems.length ? navItems.slice(0, 80) : undefined,
    footerLinks: footerLinks.length ? footerLinks.slice(0, 80) : undefined,
    sections,
    brand,
    queuedRoutes: queuedRoutes.length ? queuedRoutes : undefined,
    notes: notes.length ? notes : undefined,
    partial: partial || undefined,
  });
}
