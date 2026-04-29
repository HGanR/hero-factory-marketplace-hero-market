/**
 * PII minimization for widget logging.
 * Strip query strings, hashes, and cap lengths to reduce compliance risk.
 */

/** Canonicalize URL: origin + pathname only. Drops query string and hash. */
export function sanitizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

/** Safe title: trim and cap length. */
export function sanitizeTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = String(raw).trim();
  return t ? t.slice(0, 140) : null;
}
