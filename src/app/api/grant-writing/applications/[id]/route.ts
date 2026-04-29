import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grantApplications } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { buildGrantUpdates } from "../../shared";

function getCurrentUser(request: NextRequest): { userId?: number; isAdmin?: boolean } | null {
  const authToken = request.cookies.get("auth-token")?.value;
  const adminToken = request.cookies.get("admin-token")?.value;
  if (adminToken) {
    const decoded = verifyToken(adminToken);
    if (decoded?.isAdmin && decoded?.userId) return { userId: decoded.userId, isAdmin: true };
    if (decoded?.userId) return { userId: decoded.userId, isAdmin: false };
  }
  if (authToken) {
    const decoded = verifyToken(authToken);
    if (decoded?.userId) return { userId: decoded.userId, isAdmin: false };
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const db = await getDb();
    const [row] = await db
      .select()
      .from(grantApplications)
      .where(and(eq(grantApplications.id, id), eq(grantApplications.userId, user.userId)))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ application: row });
  } catch (err) {
    console.error("grant-writing [id] GET error:", err);
    return NextResponse.json({ error: "Failed to load application" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const body = await req.json();
    const db = await getDb();
    const updates = buildGrantUpdates(body);
    if (Object.keys(updates).length === 0) {
      const [row] = await db.select().from(grantApplications).where(and(eq(grantApplications.id, id), eq(grantApplications.userId, user.userId))).limit(1);
      return NextResponse.json({ application: row ?? null });
    }
    await db
      .update(grantApplications)
      .set(updates as any)
      .where(and(eq(grantApplications.id, id), eq(grantApplications.userId, user.userId)));
    const [updated] = await db.select().from(grantApplications).where(eq(grantApplications.id, id)).limit(1);
    return NextResponse.json({ application: updated });
  } catch (err) {
    console.error("grant-writing [id] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const db = await getDb();
    await db
      .delete(grantApplications)
      .where(and(eq(grantApplications.id, id), eq(grantApplications.userId, user.userId)));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("grant-writing [id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
