import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientPortalInvites, clientPortalUsers } from "@/lib/db/schema";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
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
  if (!(await getOwnedClientRow(userId, clientId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureClientPortalTables();
  const db = await getDb();
  const now = new Date();
  const users = await db
    .select({
      id: clientPortalUsers.id,
      email: clientPortalUsers.email,
      name: clientPortalUsers.name,
      role: clientPortalUsers.role,
      status: clientPortalUsers.status,
      lastLoginAt: clientPortalUsers.lastLoginAt,
      createdAt: clientPortalUsers.createdAt,
    })
    .from(clientPortalUsers)
    .where(and(eq(clientPortalUsers.clientId, clientId), eq(clientPortalUsers.ownerUserId, userId)))
    .orderBy(desc(clientPortalUsers.createdAt));

  const pendingInvites = await db
    .select({
      id: clientPortalInvites.id,
      email: clientPortalInvites.email,
      role: clientPortalInvites.role,
      expiresAt: clientPortalInvites.expiresAt,
      createdAt: clientPortalInvites.createdAt,
    })
    .from(clientPortalInvites)
    .where(
      and(
        eq(clientPortalInvites.clientId, clientId),
        eq(clientPortalInvites.ownerUserId, userId),
        isNull(clientPortalInvites.acceptedAt),
        isNull(clientPortalInvites.revokedAt),
        gte(clientPortalInvites.expiresAt, now),
      ),
    )
    .orderBy(desc(clientPortalInvites.createdAt));

  return NextResponse.json({ users, pendingInvites });
}
