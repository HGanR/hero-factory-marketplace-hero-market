import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  buildFollowUpRecommendations,
  gatherClientFollowUpSignals,
} from "@/lib/executive-agent/client-followup-intelligence";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getDb();
    const signals = await gatherClientFollowUpSignals(db, { db, adminUserId });
    const recommendations = buildFollowUpRecommendations(signals);
    return NextResponse.json({ signals, recommendations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "CLIENT_FOLLOW_UP_FAILED", message: msg }, { status: 500 });
  }
}
