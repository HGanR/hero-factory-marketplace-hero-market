import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { buildContent360ReadinessForClient } from "@/lib/revenue-os/content360-readiness-server";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

/**
 * GET /api/revenue-os/content360/readiness?clientId=
 */
export async function GET(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  const owned = await requireOwnedClientId(userId, clientId);
  if (!owned.ok) return owned.response;

  await ensureClientHubTables();
  const db = await getDb();
  const readiness = await buildContent360ReadinessForClient(db, owned.clientId);

  return NextResponse.json(readiness);
}
