import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { grantApplications } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { ensureGrantApplicationsTable } from "../ensure-table";
import { buildGrantValues } from "../shared";

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

export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await ensureGrantApplicationsTable();
    const db = await getDb();
    const rows = await db
      .select()
      .from(grantApplications)
      .where(eq(grantApplications.userId, user.userId))
      .orderBy(desc(grantApplications.updatedAt))
      .limit(100);
    return NextResponse.json({ applications: rows });
  } catch (err) {
    console.error("grant-writing GET error:", err);
    return NextResponse.json({ error: "Failed to load applications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const title = String(body?.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    await ensureGrantApplicationsTable();
    const db = await getDb();
    const status = ["draft", "submitted", "awarded", "declined"].includes(body?.status)
      ? body.status
      : "draft";
    const vals = buildGrantValues(body, { userId: user.userId, title, status });
    await db.insert(grantApplications).values(vals as typeof grantApplications.$inferInsert);
    const [inserted] = await db
      .select()
      .from(grantApplications)
      .where(eq(grantApplications.userId, user.userId))
      .orderBy(desc(grantApplications.id))
      .limit(1);
    return NextResponse.json({ application: inserted ?? { title } });
  } catch (err) {
    console.error("grant-writing POST error:", err);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
