import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveAmbientSignalSnapshot } from "@/lib/executive-agent/executive-ambient-signal-engine";

export const dynamic = "force-dynamic";

/** GET /api/admin/executive-agent/signals/feed — cinematic operational event feed (advisory only). */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getDb();
    const snapshot = await buildExecutiveAmbientSignalSnapshot(db, adminUserId);
    return NextResponse.json({ ok: true, ...snapshot.feed, orbState: snapshot.orbState });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Signal feed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
