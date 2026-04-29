import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, getClientAnalyticsForClient, getOwnedClientRow } from "@/lib/revenue-os/client-hub-queries";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { clientId } = await ctx.params;
    try {
      assertValidClientId(clientId);
    } catch {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }
    if (!(await getOwnedClientRow(userId, clientId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const analytics = await getClientAnalyticsForClient(userId, clientId);
    if (!analytics) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ analytics });
  } catch (e) {
    console.error("GET .../analytics", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
