import { NextResponse } from "next/server";
import { makeId, merchStore } from "@/lib/merch/mock-db";
import { CreateVersionSchema } from "@/lib/zod/version";
import { getDb } from "@/lib/db";
import { merchProjects, merchVersions } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { desc, eq } from "drizzle-orm";

const nowIso = () => new Date().toISOString();
type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const items = await db
      .select()
      .from(merchVersions)
      .where(eq(merchVersions.projectId, projectId))
      .orderBy(desc(merchVersions.createdAt));
    return NextResponse.json({ items });
  } catch {
    const items = merchStore.versions.filter((v) => v.projectId === projectId);
    return NextResponse.json({ items });
  }
}

export async function POST(req: Request, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = CreateVersionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const payload = parsed.data;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [project] = await db.select().from(merchProjects).where(eq(merchProjects.id, projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const id = makeId("version");
    await db.insert(merchVersions).values({
      id,
      projectId,
      kind: payload.kind,
      prompt: payload.prompt ?? null,
      negativePrompt: payload.negativePrompt ?? null,
      seed: payload.seed ?? null,
      modelVersion: payload.modelVersion || "v1",
      paramsJson: payload.params || {},
    });
    const [item] = await db.select().from(merchVersions).where(eq(merchVersions.id, id)).limit(1);
    return NextResponse.json(item, { status: 201 });
  } catch {
    const project = merchStore.projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const item = {
      id: makeId("version"),
      projectId,
      kind: payload.kind,
      prompt: payload.prompt,
      negativePrompt: payload.negativePrompt,
      seed: payload.seed,
      modelVersion: payload.modelVersion || "v1",
      paramsJson: payload.params || {},
      createdAt: nowIso(),
    };
    merchStore.versions.unshift(item);
    return NextResponse.json(item, { status: 201 });
  }
}

