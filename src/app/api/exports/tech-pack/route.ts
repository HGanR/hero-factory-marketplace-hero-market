import { NextResponse } from "next/server";
import { enqueueJob } from "@/lib/jobs/queue";
import { makeId, merchStore } from "@/lib/merch/mock-db";
import { CreateExportSchema } from "@/lib/zod/export";
import { getDb } from "@/lib/db";
import { merchExports, merchProjects } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { eq } from "drizzle-orm";

const nowIso = () => new Date().toISOString();

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = CreateExportSchema.safeParse({ ...body, type: "TECHPACK_PDF" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const payload = parsed.data;
  const exportId = makeId("export");
  const url = `/downloads/tech-pack-${exportId}.pdf`;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [project] = await db.select().from(merchProjects).where(eq(merchProjects.id, payload.projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    await db.insert(merchExports).values({
      id: exportId,
      projectId: payload.projectId,
      type: "TECHPACK_PDF",
      url,
    });
  } catch {
    const project = merchStore.projects.find((p) => p.id === payload.projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    merchStore.exports.unshift({
      id: exportId,
      projectId: payload.projectId,
      type: "TECHPACK_PDF",
      url,
      createdAt: nowIso(),
    });
  }
  const jobId = await enqueueJob("EXPORT_PDF", {
    exportId,
    projectId: payload.projectId,
    selectedRenderIds: payload.selectedRenderIds || [],
  });
  return NextResponse.json({ exportId, url, jobId }, { status: 202 });
}

