import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientAccounts, clientPortalInvites, clientPortalUsers } from "@/lib/db/schema";
import { hashInviteToken } from "@/lib/client-portal/invite-token";
import { createClientPortalToken } from "@/lib/client-portal/portal-token";
import { checkPortalRateLimit } from "@/lib/client-portal/portal-rate-limit";
import { logClientPortalActivity } from "@/lib/client-portal/portal-activity";
import { cookieHostFromRequest, sessionCookieBase } from "@/lib/auth-cookie-options";

const MIN_PASS = 8;

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  let body: { token?: string; name?: string; password?: string };
  try {
    body = (await req.json()) as { token?: string; name?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawToken = String(body.token ?? "").trim();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  if (rawToken.length < 8) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  if (name.length < 1) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (password.length < MIN_PASS) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASS} characters` }, { status: 400 });
  }

  const th = hashInviteToken(rawToken);
  const lim = checkPortalRateLimit(`cp-accept:${th.slice(0, 16)}`, 10, 15 * 60_000);
  if (!lim.ok) {
    return NextResponse.json(
      { error: "Too many attempts", retryAfter: lim.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(lim.retryAfterSec) } },
    );
  }

  await ensureClientPortalTables();
  const db = await getDb();
  const now = new Date();
  const [inv] = await db
    .select()
    .from(clientPortalInvites)
    .where(
      and(
        eq(clientPortalInvites.tokenHash, th),
        isNull(clientPortalInvites.acceptedAt),
        isNull(clientPortalInvites.revokedAt),
      ),
    )
    .limit(1);
  if (!inv) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
  }
  if (inv.expiresAt && new Date(inv.expiresAt) < now) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(clientPortalUsers)
    .where(
      and(
        eq(clientPortalUsers.clientId, inv.clientId),
        eq(clientPortalUsers.email, inv.email),
      ),
    )
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "Account already exists. Use sign in." }, { status: 400 });
  }

  const [acc] = await db
    .select()
    .from(clientAccounts)
    .where(
      and(eq(clientAccounts.id, inv.clientId), eq(clientAccounts.ownerUserId, inv.ownerUserId)),
    )
    .limit(1);
  if (!acc) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  }

  const id = randomUUID();
  const passwordHash = hashPassword(password);
  const role = inv.role === "owner" || inv.role === "manager" || inv.role === "viewer" ? inv.role : "manager";
  await db.insert(clientPortalUsers).values({
    id,
    clientId: inv.clientId,
    ownerUserId: inv.ownerUserId,
    email: inv.email,
    name,
    passwordHash,
    role,
    status: "active",
  });
  await db
    .update(clientPortalInvites)
    .set({ acceptedAt: now })
    .where(eq(clientPortalInvites.id, inv.id));

  const token = createClientPortalToken({
    portalUserId: id,
    clientId: inv.clientId,
    ownerUserId: inv.ownerUserId,
    role,
  });
  await logClientPortalActivity(inv.clientId, id, "portal_invite_accepted", { email: inv.email });
  const b = sessionCookieBase(cookieHostFromRequest(req));
  const res = NextResponse.json({ ok: true, client: { name: acc.name, id: acc.id } });
  res.cookies.set("client-portal-token", token, { ...b, maxAge: 7 * 24 * 60 * 60, httpOnly: true });
  return res;
}
