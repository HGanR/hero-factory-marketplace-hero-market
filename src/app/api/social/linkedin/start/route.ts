import { NextRequest, NextResponse } from "next/server";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

/**
 * GET /api/social/linkedin/start
 * Alias for `/api/social/oauth/linkedin/start` (same query params: clientId, returnTo).
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  const u = new URL(req.url);
  const target = new URL("/api/social/oauth/linkedin/start", u.origin);
  u.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  return NextResponse.redirect(target.toString());
}
