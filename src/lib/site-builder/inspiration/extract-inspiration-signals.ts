import * as cheerio from "cheerio";
import { isBlockedHost } from "@/lib/site-builder/site-import/fetch-remote-html";

const MAX_INSPIRATION_BYTES = 1_500_000;
const FETCH_TIMEOUT_MS = 12_000;

export type InspirationPageSignals = {
  pageTitle: string;
  metaDescription: string;
  headings: { level: 1 | 2 | 3; text: string }[];
  paragraphs: string[];
  ctaLabels: string[];
  navLabels: string[];
  linkLabels: string[];
  colorHints: string[];
  /** Approximate order of major section-like blocks (heuristic) */
  sectionHeadings: string[];
};

/**
 * Public URL fetch for inspiration: https only after host check, no cookies, no Firecrawl.
 */
export async function fetchInspirationHtmlPublic(urlStr: string): Promise<
  | { ok: true; url: string; finalUrl: string; html: string; robotsRespectedNote: string }
  | { ok: false; code: string; message: string }
> {
  let url: URL;
  try {
    url = new URL(urlStr.trim());
  } catch {
    return { ok: false, code: "invalid_url", message: "Could not parse URL." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, code: "unsupported_protocol", message: "Only https URLs are allowed for inspiration analysis." };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, code: "blocked_host", message: "This host is not allowed (private or local addresses are blocked)." };
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "HeroFactorySiteBuilderInspiration/1.0 (+https://hero.factory) (single analysis; not for bulk crawl)",
      },
    });
    clearTimeout(t);
    if (!res.ok) {
      return {
        ok: false,
        code: "http_error",
        message: `Server returned ${res.status} ${res.statusText || ""}`.trim(),
      };
    }
    const ct = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(ct) && !/text\/plain/i.test(ct)) {
      return { ok: false, code: "not_html", message: "Response does not look like HTML." };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_INSPIRATION_BYTES) {
      return { ok: false, code: "too_large", message: "Page exceeds the analysis size limit." };
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return {
      ok: true,
      url: url.toString(),
      finalUrl: res.url || url.toString(),
      html,
      robotsRespectedNote:
        "Respect the site’s robots.txt and terms; this is a one-off, user-initiated fetch for non-verbatim pattern hints only.",
    };
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : "Fetch failed.";
    if (msg.includes("abort")) {
      return { ok: false, code: "timeout", message: "Request timed out — try a faster-loading page." };
    }
    return { ok: false, code: "fetch_failed", message: msg };
  }
}

function extractHexColors(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g)) {
    out.push(m[0]!);
  }
  return [...new Set(out)].slice(0, 12);
}

/**
 * Strip unsafe/navigation noise; keep only text from safe tags for heuristics.
 */
export function extractInspirationSignalsFromHtml(html: string): InspirationPageSignals {
  const $ = cheerio.load(html);
  $("script, style, noscript, iframe, object, svg, template").remove();
  $("[onclick],[onload],[onerror]").removeAttr("onclick").removeAttr("onload").removeAttr("onerror");

  const pageTitle = $("title").first().text().trim().slice(0, 200);
  const metaDescription =
    $('meta[name="description"], meta[property="og:description"]').attr("content")?.trim().slice(0, 500) || "";

  const headings: { level: 1 | 2 | 3; text: string }[] = [];
  $("h1, h2, h3").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() || "";
    const level = (tag === "h1" ? 1 : tag === "h2" ? 2 : 3) as 1 | 2 | 3;
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text && text.length < 200) headings.push({ level, text });
  });

  const paragraphs: string[] = [];
  $("p").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t.length > 20 && t.length < 500) paragraphs.push(t);
  });

  const ctaLabels: string[] = [];
  const navLabels: string[] = [];
  const linkLabels: string[] = [];

  $("a, button").each((_, el) => {
    const tag = (el as { tagName?: string }).tagName?.toLowerCase() || "";
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (!t || t.length > 80) return;
    const parentNav = $(el).closest("nav, header, [role='navigation']").length;
    if (parentNav) navLabels.push(t);
    else if (tag === "button" || /get|book|start|try|request|join|contact|sign|learn|demo|call/i.test(t)) {
      ctaLabels.push(t);
    } else linkLabels.push(t);
  });

  const colorHints: string[] = [];
  $("[style]").each((_, el) => {
    const st = $(el).attr("style") || "";
    colorHints.push(...extractHexColors(st));
  });
  $('link[rel="stylesheet"], style').each((_, el) => {
    // skip huge inline; cheerio may still give body - cap read
    const t = $(el).text() || $(el).attr("href") || "";
    if (t.length < 8_000) colorHints.push(...extractHexColors(t));
  });

  const sectionHeadings = headings.filter((h) => h.level === 2 || h.level === 3).map((h) => h.text).slice(0, 14);

  return {
    pageTitle,
    metaDescription,
    headings: headings.slice(0, 30),
    paragraphs: paragraphs.slice(0, 40),
    ctaLabels: [...new Set(ctaLabels)].slice(0, 24),
    navLabels: [...new Set(navLabels)].slice(0, 20),
    linkLabels: [...new Set(linkLabels)].slice(0, 30),
    colorHints: [...new Set(colorHints)].slice(0, 16),
    sectionHeadings,
  };
}

export function isPrivateOrLocalUrlForTests(host: string): boolean {
  return isBlockedHost(host);
}
