/**
 * Public template URL helpers for LiveKit room-composite customBaseUrl.
 * Egress merges `layout`, `url`, and `token` query params; we preserve rsid/rt.
 */

export function broadcastTemplatePublicOrigin(): string | null {
  const direct = process.env.MEET_BROADCAST_TEMPLATE_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (direct) {
    const u = direct.replace(/\/$/, "");
    if (/^https?:\/\//i.test(u)) return u;
    return `https://${u.replace(/^\/\//, "")}`;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/\/$/, "");
    return host.startsWith("http") ? host : `https://${host}`;
  }
  return null;
}

export function buildBroadcastTemplateUrl(origin: string, renderSessionId: number, accessToken: string): string {
  const base = origin.replace(/\/$/, "");
  const u = new URL(`${base}/meet/broadcast-template`);
  u.searchParams.set("rsid", String(renderSessionId));
  u.searchParams.set("rt", accessToken);
  return u.toString();
}
