/**
 * Public origin for invite / login links.
 */
export function getAppOriginForClientPortal(): string {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) return v.startsWith("http") ? v.replace(/\/$/, "") : `https://${v}`;
  return "http://localhost:3000";
}
