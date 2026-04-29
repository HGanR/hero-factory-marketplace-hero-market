import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { inboxListRowBadges } from "@/lib/social/engagement/inbox-list-badges";
import { listEngagementThreadsForClient } from "@/lib/social/engagement/upsert-social-engagement";

/**
 * GET /api/revenue-os/inbox/threads?clientId=...&limit=50
 * Lists engagement threads (Smart Inbox scaffold).
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
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || "50") || 50));
  const db = await getDb();
  const raw = await listEngagementThreadsForClient(db, { userId: String(userId), clientId, limit });
  const items = raw.map((t) => ({ ...t, badges: inboxListRowBadges(t) }));
  return NextResponse.json({ items });
}
