import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-ownership";
import { getClientServiceStatusForOperator } from "@/lib/revenue-os/client-portal-service-db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const __ros = await enforceRevenueOsApiAccess();
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
  const row = await getClientServiceStatusForOperator(userId, clientId);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ service: row });
}
