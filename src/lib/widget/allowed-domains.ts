/**
 * allowedDomains enforcement for widget endpoints.
 */

export function parseAllowedDomains(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return raw
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }
}

export function isOriginAllowed(originOrReferer: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  if (!originOrReferer?.trim()) return true;

  let host = "";
  try {
    const u = new URL(originOrReferer);
    host = u.hostname.toLowerCase();
  } catch {
    return true;
  }

  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) return true;

  return allowed.some((d) => {
    const domain = d
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^\./, "");
    return host === domain || host.endsWith("." + domain);
  });
}
