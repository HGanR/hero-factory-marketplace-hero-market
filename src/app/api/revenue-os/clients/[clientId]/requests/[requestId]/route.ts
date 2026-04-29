import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { updateOperatorRequestStatus } from "@/lib/client-portal/portal-requests";

type Ctx = { params: Promise<{ clientId: string; requestId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const __ros = await enforceRevenueOsApiAccess(req);
  if (__ros) return __ros;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let clientId: string;
  let requestId: string;
  try {
    ({ clientId, requestId } = await ctx.params);
    assertValidClientId(clientId);
  } catch {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }
  if (!(await getOwnedClientRow(userId, clientId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; operatorNote?: unknown };
  const item = await updateOperatorRequestStatus(userId, clientId, requestId, body);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item });
}
