import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { loadInboxDiagnostics } from "@/lib/social/engagement/inbox-diagnostics";

/**
 * GET /api/revenue-os/inbox/diagnostics?clientId=&days=7
 */
export async function GET(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const clientId = (searchParams.get("clientId") || "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  const days = Math.min(30, Math.max(1, Number(searchParams.get("days") || "7") || 7));
  const db = await getDb();
  const d = await loadInboxDiagnostics(db, { userId: String(userId), clientId, days });
  return NextResponse.json({ days, ...d });
}
