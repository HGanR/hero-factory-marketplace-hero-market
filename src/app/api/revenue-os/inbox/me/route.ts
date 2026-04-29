import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

/**
 * GET /api/revenue-os/inbox/me
 * Exposes the operator id for assign-to-self (no PII).
 */
export async function GET(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ userId: String(userId) });
}
