import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildTrooTownEvanaOverview } from "@/lib/executive-agent/troo-town-evana-service";

export const dynamic = "force-dynamic";

/** GET /api/admin/executive-agent/troo-town/evana/overview — masked Evaana visitor sessions for Skipper desk. */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const sessionLimit = limitRaw ? Number(limitRaw) : undefined;

  const db = await getDb();
  const overview = await buildTrooTownEvanaOverview(db, {
    sessionLimit: Number.isFinite(sessionLimit) ? sessionLimit : undefined,
  });

  return NextResponse.json(overview);
}
