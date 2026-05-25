/**
 * Shared options for auth cookies so login/logout/siwe stay consistent.
 *
 * Set `AUTH_COOKIE_DOMAIN=.troothhurtz.app` in Vercel so sessions work on both
 * apex and www (host-only cookies do not cross those hosts). Use a **host only** — not
 * `https://…` (that will not match and the Domain attribute will be skipped).
 *
 * The Domain attribute is only applied when the incoming request Host matches
 * that domain. Otherwise browsers reject Set-Cookie (e.g. preview URLs on
 * *.vercel.app while AUTH_COOKIE_DOMAIN points at production).
 */

function normalizeHost(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

/** Prefer forwarded host (Vercel / proxies), then Host. */
export function cookieHostFromRequest(request: { headers: Headers }): string {
  const xf = request.headers.get("x-forwarded-host");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return normalizeHost(first);
  }
  const h = request.headers.get("host") ?? "";
  return normalizeHost(h);
}

function normalizeCookieDomainEnv(raw: string): string {
  let s = raw.trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).hostname;
    } catch {
      s = s.replace(/^https?:\/\//i, "").split("/")[0] ?? s;
    }
  }
  return s.split(":")[0].trim().toLowerCase();
}

function pickCookieDomain(requestHost: string | null | undefined): string | undefined {
  const raw = process.env.AUTH_COOKIE_DOMAIN?.trim();
  if (!raw || raw.includes("localhost") || raw.includes("127.0.0.1")) return undefined;

  const host = (requestHost ?? "").trim();
  if (!host) return undefined;

  const normalized = normalizeCookieDomainEnv(raw);
  if (!normalized) return undefined;
  const cookieRoot = normalized.startsWith(".") ? normalized.slice(1) : normalized;
  const h = normalizeHost(host);
  if (h === cookieRoot || h.endsWith(`.${cookieRoot}`)) {
    return normalized.startsWith(".") ? normalized : `.${cookieRoot}`;
  }
  return undefined;
}

export function sessionCookieBase(requestHost?: string | null): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  domain?: string;
} {
  const secure = process.env.NODE_ENV === "production";
  const domain = pickCookieDomain(requestHost ?? undefined);
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    ...(domain ? { domain } : {}),
  };
}
