export type FetchRemoteHtmlOk = {
  ok: true;
  /** Requested URL */
  url: string;
  /** Final URL after redirects */
  finalUrl: string;
  html: string;
  contentType: string;
};

export type FetchRemoteHtmlErr = {
  ok: false;
  code: string;
  message: string;
};

export type FetchRemoteHtmlResult = FetchRemoteHtmlOk | FetchRemoteHtmlErr;

const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 18_000;

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "0.0.0.0" || h === "[::1]" || h === "::1") return true;
  if (h.startsWith("127.")) return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (h.startsWith("172.")) {
    const p = h.split(".");
    const n = Number(p[1]);
    if (n >= 16 && n <= 31) return true;
  }
  if (h.endsWith(".internal")) return true;
  return false;
}

export async function fetchRemoteHtmlForImport(rawUrl: string): Promise<FetchRemoteHtmlResult> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { ok: false, code: "invalid_url", message: "Could not parse URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, code: "unsupported_protocol", message: "Only http(s) URLs are supported." };
  }
  if (isBlockedHost(url.hostname)) {
    return { ok: false, code: "blocked_host", message: "This host is not allowed for import." };
  }

  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url: url.toString(),
          formats: ["html"],
          waitFor: 1500, // Allow SPAs to render
        }),
      });
      if (fcRes.ok) {
        const json = await fcRes.json() as { success: boolean; data?: { html?: string; metadata?: { sourceURL?: string } } };
        if (json.success && json.data && json.data.html) {
          return {
            ok: true,
            url: url.toString(),
            finalUrl: json.data.metadata?.sourceURL || url.toString(),
            html: json.data.html,
            contentType: "text/html",
          };
        }
      }
    } catch (err) {
      console.warn("[site-builder] Firecrawl scrape failed, falling back to native fetch", err);
    }
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "HeroFactorySiteBuilderImport/1.0 (+https://hero.factory)",
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
      return {
        ok: false,
        code: "not_html",
        message: "Response does not look like HTML (check content-type).",
      };
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return {
        ok: false,
        code: "too_large",
        message: `Page exceeds ${Math.floor(MAX_BYTES / 1_000_000)}MB import limit.`,
      };
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return {
      ok: true,
      url: url.toString(),
      finalUrl: res.url || url.toString(),
      html,
      contentType: ct,
    };
  } catch (e) {
    clearTimeout(t);
    const msg = e instanceof Error ? e.message : "Fetch failed.";
    if (msg.includes("abort")) {
      return { ok: false, code: "timeout", message: "Request timed out — the site may be slow or blocking imports." };
    }
    return { ok: false, code: "fetch_failed", message: msg };
  }
}

export function sourceDomainFromUrl(urlStr: string): string {
  try {
    return new URL(urlStr).hostname || "";
  } catch {
    return "";
  }
}
