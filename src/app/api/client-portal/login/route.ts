import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureClientPortalTables } from "@/lib/db/client-portal-ensure";
import { clientAccounts, clientPortalUsers } from "@/lib/db/schema";
import { createClientPortalToken } from "@/lib/client-portal/portal-token";
import { checkPortalRateLimit } from "@/lib/client-portal/portal-rate-limit";
import { getClientPortalTokenFromRequest, verifyClientPortalToken } from "@/lib/client-portal/portal-token";
import { logClientPortalActivity } from "@/lib/client-portal/portal-activity";
import { sessionCookieBase } from "@/lib/auth-cookie-options";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
  );
}

function normalizeEmail(s: string) {
  return s.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const existing = getClientPortalTokenFromRequest(req);
  if (existing) {
    const p = verifyClientPortalToken(existing);
    if (p) {
      return NextResponse.json({ ok: true, alreadySession: true });
    }
  }

  let body: { email?: string; password?: string; clientId?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string; clientId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const email = normalizeEmail(body.email ?? "");
  const password = String(body.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  const clientHint = typeof body.clientId === "string" ? body.clientId.trim() : undefined;

  const lim = checkPortalRateLimit(`cp-login:${clientIp(req)}:${email}`, 15, 15 * 60_000);
  if (!lim.ok) {
    return NextResponse.json(
      { error: "Too many attempts", retryAfter: lim.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(lim.retryAfterSec) } },
    );
  }

  await ensureClientPortalTables();
  const db = await getDb();
  const where = and(
    eq(clientPortalUsers.email, email),
    eq(clientPortalUsers.status, "active"),
    ...(clientHint ? [eq(clientPortalUsers.clientId, clientHint)] : []),
  );
  const rows = await db.select().from(clientPortalUsers).where(where).orderBy(desc(clientPortalUsers.createdAt));
  if (rows.length === 0) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (!clientHint && rows.length > 1) {
    return NextResponse.json(
      { error: "Multiple accounts for this email. Pass clientId.", code: "CLIENT_ID_REQUIRED" },
      { status: 400 },
    );
  }
  const u = rows[0]!;
  if (u.status !== "active") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const h = u.passwordHash;
  if (!h || !verifyPassword(password, h)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const [acc] = await db
    .select()
    .from(clientAccounts)
    .where(and(eq(clientAccounts.id, u.clientId), eq(clientAccounts.ownerUserId, u.ownerUserId)))
    .limit(1);
  if (!acc) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const token = createClientPortalToken({
    portalUserId: u.id,
    clientId: u.clientId,
    ownerUserId: u.ownerUserId,
    role: u.role,
  });
  await db
    .update(clientPortalUsers)
    .set({ lastLoginAt: new Date() })
    .where(eq(clientPortalUsers.id, u.id));
  await logClientPortalActivity(u.clientId, u.id, "portal_login", { via: "password" });
  const b = sessionCookieBase();
  const res = NextResponse.json({ ok: true, client: { name: acc.name, id: acc.id } });
  res.cookies.set("client-portal-token", token, { ...b, maxAge: 7 * 24 * 60 * 60, httpOnly: true });
  return res;
}
