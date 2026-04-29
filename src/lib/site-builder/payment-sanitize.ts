/**
 * Conservative sanitization for PayPal-hosted payment surfaces (export/preview).
 */

function isPaypalScriptSrc(src: string): boolean {
  if (!/^https:\/\//i.test(src.trim())) return false;
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.replace(/^www\./, "");
    return h.includes("paypal") || h === "paypalobjects.com";
  } catch {
    return false;
  }
}

export function sanitizePaypalPaymentUrl(raw: string): string | null {
  const u = raw.trim();
  if (!u.startsWith("https://")) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "paypal.me" || host.endsWith(".paypal.com") || host === "paypal.com") return u;
    return null;
  } catch {
    return null;
  }
}

/** Strip risky attributes and scripts not loading from PayPal; keep common hosted button snippets. */
export function sanitizePaypalButtonHtml(raw: string): string {
  let s = raw.slice(0, 50000);
  s = s.replace(/\s(on\w+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/javascript:/gi, "");
  s = s.replace(/<script\b[^>]*>/gi, (tag) => {
    const srcM = /\bsrc\s*=\s*("([^"]+)"|'([^']+)'|([^\s>]+))/i.exec(tag);
    const src = srcM ? srcM[2] || srcM[3] || srcM[4] || "" : "";
    if (!src) return "<!-- script stripped: no src -->";
    return isPaypalScriptSrc(src) ? tag : "<!-- script stripped: non-PayPal src -->";
  });
  return s.trim();
}
