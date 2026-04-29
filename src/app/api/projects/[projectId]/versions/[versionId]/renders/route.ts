import { NextResponse } from "next/server";
import { enqueueJob } from "@/lib/jobs/queue";
import { merchStore } from "@/lib/merch/mock-db";
import { GenerateRenderRequest } from "@/lib/zod/render";
import { getDb } from "@/lib/db";
import { merchAssets, merchProjects, merchRenders, merchVersions } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ projectId: string; versionId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { versionId } = await params;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const items = await db.select().from(merchRenders).where(eq(merchRenders.versionId, versionId));
    return NextResponse.json({ items });
  } catch {
    const items = merchStore.renders.filter((r) => r.versionId === versionId);
    return NextResponse.json({ items });
  }
}

export async function POST(req: Request, { params }: Params) {
  const { projectId, versionId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = GenerateRenderRequest.safeParse({ ...body, projectId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const payload = parsed.data;
  let garmentTemplateUrl = payload.garmentTemplateId;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [project] = await db.select().from(merchProjects).where(eq(merchProjects.id, projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const [version] = await db.select().from(merchVersions).where(eq(merchVersions.id, versionId)).limit(1);
    if (!version || version.projectId !== projectId) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const [templateAsset] = await db.select().from(merchAssets).where(eq(merchAssets.id, payload.garmentTemplateId)).limit(1);
    garmentTemplateUrl = templateAsset?.url || payload.garmentTemplateId;
  } catch {
    const project = merchStore.projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const version = merchStore.versions.find((v) => v.id === versionId && v.projectId === projectId);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const templateAsset = merchStore.assets.find((a) => a.id === payload.garmentTemplateId);
    garmentTemplateUrl = templateAsset?.url || payload.garmentTemplateId;
  }

  const jobId = await enqueueJob("RENDER", {
    projectId,
    versionId,
    lane: payload.lane,
    prompt: payload.prompt,
    negativePrompt: payload.negativePrompt,
    seed: payload.seed,
    garmentTemplateUrl,
    garmentColorHex: payload.garmentColorHex,
    placement: payload.placement,
    stylePreset: payload.stylePreset,
    kinds: payload.kinds,
    sizePx: payload.sizePx,
  });

  return NextResponse.json({ jobId }, { status: 202 });
}

