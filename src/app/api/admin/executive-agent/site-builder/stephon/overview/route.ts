import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildStephonSiteBuilderOverview } from "@/lib/executive-agent/stephon-site-builder-service";

export const dynamic = "force-dynamic";

/** GET /api/admin/executive-agent/site-builder/stephon/overview — masked Site Builder sessions for Skipper usability desk. */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitRaw = req.nextUrl.searchParams.get("limit");
  const sessionLimit = limitRaw ? Number(limitRaw) : undefined;

  const db = await getDb();
  const overview = await buildStephonSiteBuilderOverview(db, {
    sessionLimit: Number.isFinite(sessionLimit) ? sessionLimit : undefined,
  });

  return NextResponse.json(overview);
}
