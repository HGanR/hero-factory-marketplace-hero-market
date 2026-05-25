import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { buildNeuroNetworkOverview } from "@/lib/executive-agent/neuro/neuro-search-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const overview = await buildNeuroNetworkOverview(db, adminUserId);
  return NextResponse.json(overview);
}
