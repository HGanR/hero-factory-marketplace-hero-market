import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { assertValidClientId } from "@/lib/revenue-os/client-hub-ownership";
import { createPortalInviteForOperator } from "@/lib/revenue-os/client-portal-invite-service";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

type Ctx = { params: Promise<{ clientId: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
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

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email : "";
  const roleRaw = typeof body.role === "string" ? body.role.trim() : "manager";
  const db = await getDb();
  const r = await createPortalInviteForOperator(db, userId, clientId, email, roleRaw);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
  }
  return NextResponse.json({
    inviteId: r.inviteId,
    inviteLink: r.inviteLink,
    expiresAt: r.expiresAt,
    email: r.email,
    role: r.role,
  });
}
