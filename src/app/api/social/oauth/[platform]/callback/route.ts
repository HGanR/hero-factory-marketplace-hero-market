import { NextRequest, NextResponse } from "next/server";
import { completeSocialOAuthCallback } from "@/lib/social/oauth-complete";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  const { platform } = await params;
  return completeSocialOAuthCallback(req, platform);
}
