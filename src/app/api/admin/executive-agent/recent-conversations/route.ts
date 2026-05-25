import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { loadRecentConversationsForExecutive } from "@/lib/executive-agent/executive-recent-conversations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitRaw ?? "24") || 24, 1), 100);
  try {
    const db = await getDb();
    const conversations = await loadRecentConversationsForExecutive(db, limit);
    return NextResponse.json({ conversations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "RECENT_CONVERSATIONS_FAILED", message: msg }, { status: 500 });
  }
}
