import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { merchJobs } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { jobId } = await params;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [job] = await db.select().from(merchJobs).where(eq(merchJobs.id, jobId)).limit(1);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      output: job.outputJson || null,
      error: job.error || null,
      updatedAt: job.updatedAt,
    });
  } catch {
    return NextResponse.json({ error: "Jobs database unavailable" }, { status: 503 });
  }
}

