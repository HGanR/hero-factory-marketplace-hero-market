import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { merchJobs } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";

function isAdminRequest(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return false;
  const decoded = verifyToken(token);
  return Boolean(decoded?.isAdmin);
}

export async function GET(request: NextRequest) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    await ensureMerchTables(db);

    const statusFilter = (request.nextUrl.searchParams.get("status") || "").trim();
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") || 100);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;

    const rows =
      statusFilter === "QUEUED" || statusFilter === "RUNNING" || statusFilter === "SUCCEEDED" || statusFilter === "FAILED"
        ? await db
            .select()
            .from(merchJobs)
            .where(eq(merchJobs.status, statusFilter))
            .orderBy(desc(merchJobs.updatedAt))
            .limit(limit)
        : await db.select().from(merchJobs).orderBy(desc(merchJobs.updatedAt)).limit(limit);

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error("admin merch jobs GET failed", error);
    return NextResponse.json({ error: "Failed to load merch jobs" }, { status: 500 });
  }
}

