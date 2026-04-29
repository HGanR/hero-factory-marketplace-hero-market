/**
 * Shared options for auth cookies so login/logout/siwe stay consistent.
 * Set AUTH_COOKIE_DOMAIN=.troothhurtz.app in Vercel so sessions work on both
 * apex and www (host-only cookies do not).
 */
export function sessionCookieBase(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  domain?: string;
} {
  const secure = process.env.NODE_ENV === "production";
  const raw = process.env.AUTH_COOKIE_DOMAIN?.trim();
  const domain =
    raw && !raw.includes("localhost") && !raw.includes("127.0.0.1") ? raw : undefined;
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(domain ? { domain } : {}),
  };
}
