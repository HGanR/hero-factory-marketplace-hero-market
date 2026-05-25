import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

/** Accept common JWT / DB quirks for admin flag checks. */
export function jwtIndicatesAdmin(decoded: unknown): boolean {
  if (!decoded || typeof decoded !== "object") return false;
  const o = decoded as Record<string, unknown>;
  if (o.isAdmin === true || o.isAdmin === 1) return true;
  if (typeof o.isAdmin === "string") {
    const s = o.isAdmin.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

/**
 * Resolve an admin session from cookies. Prefer `admin-token`, then `auth-token`
 * (same pattern as other admin routes that accept either).
 */
export function getAdminApiDecoded(request: NextRequest): unknown | null {
  const adminTok = request.cookies.get("admin-token")?.value?.trim();
  if (adminTok) {
    const d = verifyToken(adminTok);
    if (jwtIndicatesAdmin(d)) return d;
  }
  const authTok = request.cookies.get("auth-token")?.value?.trim();
  if (authTok) {
    const d = verifyToken(authTok);
    if (jwtIndicatesAdmin(d)) return d;
  }
  return null;
}
