import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4E — Aggregate conversion metrics + outcome hints from tracked leads.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { loadConversionAnalyticsForUser } from "@/lib/bentley-social-leads/loadConversionAnalyticsForUser";

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
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const source = url.searchParams.get("source")?.trim() || undefined;
  const platform = url.searchParams.get("platform")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;

  const { summary, hints, rowCount } = await loadConversionAnalyticsForUser(userId, {
    from,
    to,
    source,
    platform,
    status,
  });

  return NextResponse.json({
    summary,
    hints,
    rowCount,
  });
}
