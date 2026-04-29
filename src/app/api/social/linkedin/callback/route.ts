import { NextRequest } from "next/server";
import { completeSocialOAuthCallback } from "@/lib/social/oauth-complete";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

/**
 * GET /api/social/linkedin/callback
 * Optional alternate callback when `LINKEDIN_OAUTH_REDIRECT_URI` points here.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  return completeSocialOAuthCallback(req, "linkedin");
}
