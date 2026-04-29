/**
 * Shared public HTML fetch + parsing helpers for social surface extraction.
 * Read-only GET; no auth bypass; text/metadata only.
 */

export const BENTLEY_SLI_UA =
  "BentleySocialLeadIntel/2.0 (+https://troothhurtz.com; public metadata analysis only; no outreach)";

export const PRIVATE_OR_LOGIN_HINTS = [
  /this account is private/i,
  /this page isn'?t available/i,
  /log in to continue/i,
  /login to view/i,
  /sign in to continue/i,
  /content isn'?t available/i,
  /age-restricted/i,
  /followers only/i,
  /sensitive content/i,
  /log in to instagram/i,
];

export function extractMetaContent(html: string, prop: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop.replace(/\./g, "\\.")}["'][^>]+content=["']([^"']*)["']`,
    "i"
  );
  const m = html.match(re);
  if (m?.[1]) return m[1];
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop.replace(/\./g, "\\.")}["']`,
    "i"
  );
  return html.match(re2)?.[1];
}

export function extractTitle(html: string): string | undefined {
  const og = extractMetaContent(html, "og:title");
  if (og) return og;
  const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return t?.[1]?.trim();
}

export function extractDescription(html: string): string | undefined {
  return (
    extractMetaContent(html, "og:description") ||
    extractMetaContent(html, "description") ||
    undefined
  );
}

export function parseCountToken(s: string): number | null {
  const t = s.trim().toUpperCase().replace(/,/g, "");
  const m = t.match(/^([\d.]+)(K|M|B)?$/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === "K") n *= 1_000;
  if (m[2] === "M") n *= 1_000_000;
  if (m[2] === "B") n *= 1_000_000_000;
  return Math.round(n);
}

export function sniffFollowerCounts(html: string): { followers?: number; following?: number } {
  const out: { followers?: number; following?: number } = {};
  const fm = html.match(/([\d,.]+[KMB]?)\s*followers/i);
  if (fm) {
    const n = parseCountToken(fm[1]);
    if (n != null) out.followers = n;
  }
  const fg = html.match(/([\d,.]+[KMB]?)\s*following/i);
  if (fg) {
    const n = parseCountToken(fg[1]);
    if (n != null) out.following = n;
  }
  return out;
}

/** Extract first balanced JSON object after marker (bounded scan). */
export function extractJsonObjectAfter(html: string, marker: string, maxLen = 1_500_000): unknown | null {
  const idx = html.indexOf(marker);
  if (idx < 0) return null;
  const start = html.indexOf("{", idx);
  if (start < 0 || start - idx > 200) return null;
  const endLimit = Math.min(html.length, start + maxLen);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < endLimit; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const slice = html.slice(start, i + 1);
        try {
          return JSON.parse(slice) as unknown;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function extractScriptJsonById(html: string, scriptId: string): unknown | null {
  const re = new RegExp(
    `<script[^>]*id=["']${scriptId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>([\\s\\S]*?)<\\/script>`,
    "i"
  );
  const m = html.match(re);
  if (!m?.[1]) return null;
  const raw = m[1].trim();
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export async function fetchPublicHtml(
  profileUrl: string,
  timeoutMs = 18_000
): Promise<{ ok: boolean; url: string; html: string; status: number; error?: string }> {
  let url: URL;
  try {
    url = new URL(profileUrl.trim().startsWith("http") ? profileUrl.trim() : `https://${profileUrl.trim()}`);
  } catch {
    return { ok: false, url: profileUrl, html: "", status: 0, error: "bad_url" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, url: url.toString(), html: "", status: 0, error: "bad_protocol" };
  }
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": BENTLEY_SLI_UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const html = await res.text();
    return { ok: res.ok, url: url.toString(), html, status: res.status };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, url: url.toString(), html: "", status: 0, error: msg };
  }
}
