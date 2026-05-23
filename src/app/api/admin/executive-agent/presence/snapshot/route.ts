import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutivePresenceSnapshot } from "@/lib/executive-agent/executive-presence-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const record = req.nextUrl.searchParams.get("recordCheckIn") === "1";
    const db = await getDb();
    const snapshot = await buildExecutivePresenceSnapshot(db, adminUserId, { recordCheckIn: record });
    return NextResponse.json(snapshot);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Presence snapshot failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
