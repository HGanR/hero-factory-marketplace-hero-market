/**
 * Sanitize OAuth return paths — same-origin relative paths only (no open redirects).
 */
export function sanitizeOAuthReturnPath(returnTo: string | undefined, defaultPath = "/ai-revenue-os"): string {
  if (!returnTo?.trim()) return defaultPath;
  const t = returnTo.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return defaultPath;
  if (t.includes("..") || t.includes("\\") || t.includes("\0")) return defaultPath;
  return t;
}
