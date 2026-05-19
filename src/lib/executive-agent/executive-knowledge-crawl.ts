import * as cheerio from "cheerio";

const DEFAULT_MAX_BYTES = 500_000;

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".localhost")) return true;
  if (h === "[::1]" || h === "0.0.0.0") return true;
  if (h === "169.254.169.254") return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  return false;
}

/** Reject non-public URLs before any server-side fetch. */
export function validateExecutiveKnowledgeCrawlUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("MISSING_URL");
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("INVALID_URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("INVALID_URL_SCHEME");
  }
  if (u.username || u.password) {
    throw new Error("CREDENTIALS_NOT_ALLOWED");
  }
  if (isBlockedHostname(u.hostname)) {
    throw new Error("PRIVATE_OR_LOCAL_HOST");
  }
  return u;
}

export async function crawlPublicUrlToPlainText(
  rawUrl: string,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<{ text: string; title: string; finalUrl: string }> {
  const u = validateExecutiveKnowledgeCrawlUrl(rawUrl);
  const res = await fetch(u.toString(), {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "User-Agent": "HeroFactoryExecutiveKnowledgeCrawl/1.0 (+https://example.invalid)",
    },
  });
  if (!res.ok) {
    throw new Error(`FETCH_HTTP_${res.status}`);
  }
  const lenHdr = res.headers.get("content-length");
  if (lenHdr) {
    const n = Number(lenHdr);
    if (Number.isFinite(n) && n > maxBytes) {
      throw new Error("RESPONSE_TOO_LARGE");
    }
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error("RESPONSE_TOO_LARGE");
  }
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("text/html") && !ct.includes("application/xhtml")) {
    throw new Error("UNSUPPORTED_CONTENT_TYPE");
  }
  const html = new TextDecoder("utf-8").decode(buf);
  const $ = cheerio.load(html);
  $("script,style,noscript,template,svg").remove();
  const title = $("title").first().text().trim() || u.hostname;
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 120_000);
  return { text, title, finalUrl: res.url };
}
