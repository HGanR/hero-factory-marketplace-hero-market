import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { listOperatorRequests } from "@/lib/client-portal/portal-requests";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const __ros = await enforceRevenueOsApiAccess(req);
  if (__ros) return __ros;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let clientId: string;
  try {
    clientId = (await ctx.params).clientId;
    assertValidClientId(clientId);
  } catch {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  if (!(await getOwnedClientRow(userId, clientId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const items = await listOperatorRequests(userId, clientId, 250);
  return NextResponse.json({ items });
}
