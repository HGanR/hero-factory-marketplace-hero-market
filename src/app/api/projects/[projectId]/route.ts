import { NextResponse } from "next/server";
import { merchStore, updateTimestamp } from "@/lib/merch/mock-db";
import { UpdateProjectSchema } from "@/lib/zod/project";
import { getDb } from "@/lib/db";
import { merchProjects, merchRenders, merchVersions } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { projectId } = await params;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [project] = await db.select().from(merchProjects).where(eq(merchProjects.id, projectId)).limit(1);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const versions = await db.select().from(merchVersions).where(eq(merchVersions.projectId, projectId));
    const versionIds = versions.map((v) => v.id);
    const renders = versionIds.length
      ? (await db.select().from(merchRenders)).filter((r) => versionIds.includes(r.versionId))
      : [];
    return NextResponse.json({ project, versions, renders });
  } catch {
    const project = merchStore.projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const versions = merchStore.versions.filter((v) => v.projectId === projectId);
    const renders = merchStore.renders.filter((r) => versions.some((v) => v.id === r.versionId));
    return NextResponse.json({ project, versions, renders });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const { projectId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = UpdateProjectSchema.safeParse(body);
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
    await db.update(merchProjects).set({
      name: payload.name ?? project.name,
      lane: payload.lane ?? project.lane,
    }).where(eq(merchProjects.id, projectId));
    const [updated] = await db.select().from(merchProjects).where(eq(merchProjects.id, projectId)).limit(1);
    return NextResponse.json(updated);
  } catch {
    const project = merchStore.projects.find((p) => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (payload.name) project.name = payload.name;
    if (payload.lane) project.lane = payload.lane;
    updateTimestamp(project);
    return NextResponse.json(project);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { projectId } = await params;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    await db.delete(merchProjects).where(eq(merchProjects.id, projectId));
    await db.delete(merchVersions).where(eq(merchVersions.projectId, projectId));
    return NextResponse.json({ deleted: 1 });
  } catch {
    const before = merchStore.projects.length;
    merchStore.projects = merchStore.projects.filter((p) => p.id !== projectId);
    merchStore.versions = merchStore.versions.filter((v) => v.projectId !== projectId);
    const versionIds = new Set(merchStore.versions.map((v) => v.id));
    merchStore.renders = merchStore.renders.filter((r) => versionIds.has(r.versionId));
    merchStore.exports = merchStore.exports.filter((e) => e.projectId !== projectId);
    merchStore.orders = merchStore.orders.filter((o) => o.projectId !== projectId);
    return NextResponse.json({ deleted: before - merchStore.projects.length });
  }
}

