const PRIVATE_IPV4 = /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/;
const CGNAT_172 = /^172\.(1[6-9]|2[0-9]|3[0-1])\./;

/** Strip URL to host; normalize to lower case hostname. */
export function extractHostFromInput(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (!s) return "";
  try {
    if (s.includes("://")) {
      const u = new URL(s);
      return (u.hostname || "").toLowerCase();
    }
  } catch {
    /* fall through */
  }
  s = s.replace(/^\/+/, "");
  s = s.split("/")[0] ?? "";
  s = s.split(":")[0] ?? "";
  return s.trim().toLowerCase();
}

export function isBlockedPrivateOrLocalHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (PRIVATE_IPV4.test(h)) return true;
  if (CGNAT_172.test(h)) return true;
  if (h === "0.0.0.0" || h === "[::1]" || h === "::1") return true;
  if (h.startsWith("[fd") || h.startsWith("[fe80:")) return true;
  return false;
}

const RELAXED_DOMAIN = /^[a-z0-9_]([a-z0-9_-]*[a-z0-9])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9])?)+$/i;

/**
 * Allow Web2 + web3 TLDs (e.g. .crypto). Max 253 chars, single label max 63.
 * Reject obvious URL paths and spaces.
 */
export function sanitizeDomainName(raw: string): { ok: true; domain: string } | { ok: false; error: string } {
  const host = extractHostFromInput(raw);
  if (!host) {
    return { ok: false, error: "Domain is required." };
  }
  if (host.length > 253) {
    return { ok: false, error: "Domain is too long." };
  }
  if (isBlockedPrivateOrLocalHost(host)) {
    return { ok: false, error: "That host is not allowed for public domain connection." };
  }
  for (const label of host.split(".")) {
    if (label.length > 63 || !label.length) {
      return { ok: false, error: "Invalid domain label." };
    }
  }
  if (!RELAXED_DOMAIN.test(host) && !/^xn--/.test(host)) {
    return { ok: false, error: "Use a valid domain (e.g. example.com or brand.crypto)." };
  }
  return { ok: true, domain: host };
}

export function sanitizeTargetUrlInput(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const t = raw.trim();
  if (!t) {
    return { ok: false, error: "Target URL is required." };
  }
  let u: URL;
  try {
    u = t.includes("://") ? new URL(t) : new URL(`https://${t}`);
  } catch {
    return { ok: false, error: "Enter a valid https URL (your Vercel or static site)." };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { ok: false, error: "Target URL must be http or https." };
  }
  const host = u.hostname.toLowerCase();
  if (isBlockedPrivateOrLocalHost(host)) {
    return { ok: false, error: "That target host is not allowed (use a public Vercel or static URL)." };
  }
  return { ok: true, url: u.toString() };
}
