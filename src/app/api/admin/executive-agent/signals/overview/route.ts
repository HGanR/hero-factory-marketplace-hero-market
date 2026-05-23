import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildExecutiveAmbientSignalSnapshot } from "@/lib/executive-agent/executive-ambient-signal-engine";

export const dynamic = "force-dynamic";

/** GET /api/admin/executive-agent/signals/overview — ambient signal intelligence overview. */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const audit = req.nextUrl.searchParams.get("audit") !== "0";
    const db = await getDb();
    const snapshot = await buildExecutiveAmbientSignalSnapshot(db, adminUserId, { audit });
    return NextResponse.json({ ok: true, ...snapshot });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Signal overview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
