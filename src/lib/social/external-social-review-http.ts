import type { NextRequest } from "next/server";

/**
 * Prefer `Authorization: Bearer <token>`; optional `?token=` for GET bookmarking (avoid sharing POST URLs with tokens).
 */
export function extractExternalSocialReviewToken(req: NextRequest): string | null {
  const h = req.headers.get("authorization");
  if (h?.trim().toLowerCase().startsWith("bearer ")) {
    const t = h.slice(7).trim();
    if (t) return t;
  }
  const q = new URL(req.url).searchParams.get("token")?.trim();
  if (q) return q;
  return null;
}
