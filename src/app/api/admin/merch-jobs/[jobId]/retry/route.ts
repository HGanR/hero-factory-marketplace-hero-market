import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { merchJobs } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";

type Params = { params: Promise<{ jobId: string }> };

function isAdminRequest(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return false;
  const decoded = verifyToken(token);
  return Boolean(decoded?.isAdmin);
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;
    const db = await getDb();
    await ensureMerchTables(db);

    const [existing] = await db.select().from(merchJobs).where(eq(merchJobs.id, jobId)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (existing.status !== "FAILED") {
      return NextResponse.json({ error: "Only FAILED jobs can be retried" }, { status: 400 });
    }

    await db
      .update(merchJobs)
      .set({
        status: "QUEUED",
        error: null,
        outputJson: null,
      })
      .where(and(eq(merchJobs.id, jobId), eq(merchJobs.status, "FAILED")));

    const [job] = await db.select().from(merchJobs).where(eq(merchJobs.id, jobId)).limit(1);
    return NextResponse.json({ job });
  } catch (error) {
    console.error("admin merch jobs retry failed", error);
    return NextResponse.json({ error: "Failed to retry merch job" }, { status: 500 });
  }
}

