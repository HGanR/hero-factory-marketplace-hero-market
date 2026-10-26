/** Mobile accepts member cookies only; never substitute an administrator identity. */
export function mobileMemberId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (p.isAdmin === true) return null;
  const raw = p.userId;
  if (typeof raw !== "number" && !(typeof raw === "string" && /^[1-9][0-9]*$/.test(raw))) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
export function mobileSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !!origin && origin === new URL(request.url).origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
export function mobileCredentials(value: unknown): {identifier: string; password: string} | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.identifier !== "string" || typeof v.password !== "string") return null;
  const identifier = v.identifier.trim();
  if (!identifier || identifier.length > 320 || !v.password || v.password.length > 1024) return null;
  return {identifier, password: v.password};
}
