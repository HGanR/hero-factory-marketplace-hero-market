import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4H — Compare variant outcomes via deployment → lead linkage.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { getVariantRollupsForExperimentGroup } from "@/lib/generation-memory/variantRollupsQuery";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const experimentGroupId = url.searchParams.get("experimentGroupId")?.trim();
  if (!experimentGroupId) {
    return NextResponse.json({ error: "experimentGroupId is required" }, { status: 400 });
  }

  const rollups = await getVariantRollupsForExperimentGroup(userId, experimentGroupId);

  return NextResponse.json({ experimentGroupId, rollups });
}
