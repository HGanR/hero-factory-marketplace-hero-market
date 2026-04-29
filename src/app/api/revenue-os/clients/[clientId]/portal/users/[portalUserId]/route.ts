import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientPortalUsers } from "@/lib/db/schema";
import { logClientPortalActivity } from "@/lib/client-portal/portal-activity";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

type Ctx = { params: Promise<{ clientId: string; portalUserId: string }> };

const ROLE = new Set(["owner", "manager", "viewer"]);
const STATUS = new Set(["invited", "active", "suspended", "revoked"]);

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const __ros = await enforceRevenueOsApiAccess(req);
  if (__ros) return __ros;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, portalUserId } = await ctx.params;
  try {
    assertValidClientId(clientId);
  } catch {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  if (!(await getOwnedClientRow(userId, clientId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await ensureClientPortalTables();
  const db = await getDb();
  const [u] = await db
    .select()
    .from(clientPortalUsers)
    .where(
      and(
        eq(clientPortalUsers.id, portalUserId),
        eq(clientPortalUsers.clientId, clientId),
        eq(clientPortalUsers.ownerUserId, userId),
      ),
    )
    .limit(1);
  if (!u) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const set: Record<string, unknown> = {};
  if (body.role != null) {
    const r = String(body.role).trim();
    if (!ROLE.has(r)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    set.role = r;
  }
  if (body.status != null) {
    const s = String(body.status).trim();
    if (!STATUS.has(s)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    set.status = s;
  }
  if (body.name != null) {
    if (body.name === null) set.name = null;
    else {
      const n = String(body.name).trim();
      if (!n) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      set.name = n;
    }
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status } });
  }
  await db
    .update(clientPortalUsers)
    .set({
      ...(set.role != null ? { role: set.role as string } : {}),
      ...(set.status != null ? { status: set.status as string } : {}),
      ...(set.name !== undefined ? { name: (set.name as string | null) ?? null } : {}),
    })
    .where(eq(clientPortalUsers.id, portalUserId));
  await logClientPortalActivity(clientId, null, "operator_portal_user_update", { portalUserId, patch: set });
  const [u2] = await db
    .select()
    .from(clientPortalUsers)
    .where(eq(clientPortalUsers.id, portalUserId))
    .limit(1);
  return NextResponse.json({ user: u2 });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const __ros = await enforceRevenueOsApiAccess();
  if (__ros) return __ros;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { clientId, portalUserId } = await ctx.params;
  try {
    assertValidClientId(clientId);
  } catch {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  if (!(await getOwnedClientRow(userId, clientId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await ensureClientPortalTables();
  const db = await getDb();
  const [existing] = await db
    .select({ id: clientPortalUsers.id })
    .from(clientPortalUsers)
    .where(
      and(
        eq(clientPortalUsers.id, portalUserId),
        eq(clientPortalUsers.clientId, clientId),
        eq(clientPortalUsers.ownerUserId, userId),
      ),
    )
    .limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db
    .update(clientPortalUsers)
    .set({ status: "revoked" })
    .where(
      and(
        eq(clientPortalUsers.id, portalUserId),
        eq(clientPortalUsers.clientId, clientId),
        eq(clientPortalUsers.ownerUserId, userId),
      ),
    );
  await logClientPortalActivity(clientId, null, "operator_portal_user_revoked", { portalUserId });
  return NextResponse.json({ ok: true });
}
