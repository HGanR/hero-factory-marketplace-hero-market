import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { makeId, merchStore, updateTimestamp } from "@/lib/merch/mock-db";
import { CreateProjectSchema } from "@/lib/zod/project";
import { getDb } from "@/lib/db";
import { merchProjects } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { getAuthedUserId } from "@/lib/api/auth";

const nowIso = () => new Date().toISOString();

export async function GET() {
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const userId = (await getAuthedUserId()) ?? 1;
    const items = await db.select().from(merchProjects).where(eq(merchProjects.userId, userId)).orderBy(desc(merchProjects.updatedAt));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: merchStore.projects });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const payload = parsed.data;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const userId = (await getAuthedUserId()) ?? 1;
    const id = makeId("project");
    await db.insert(merchProjects).values({
      id,
      userId,
      lane: payload.lane,
      name: payload.name,
    });
    const [item] = await db.select().from(merchProjects).where(eq(merchProjects.id, id)).limit(1);
    return NextResponse.json(item, { status: 201 });
  } catch {
    const createdAt = nowIso();
    const item = {
      id: makeId("project"),
      ownerId: payload.ownerId || "demo-owner",
      lane: payload.lane,
      name: payload.name,
      createdAt,
      updatedAt: createdAt,
    };
    merchStore.projects.unshift(item);
    return NextResponse.json(item, { status: 201 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || "");
  if (!id) {
    return NextResponse.json({ error: "Project id required" }, { status: 400 });
  }
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [existing] = await db.select().from(merchProjects).where(eq(merchProjects.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    await db
      .update(merchProjects)
      .set({
        name: typeof body?.name === "string" && body.name.trim() ? body.name.trim() : existing.name,
        lane: body?.lane === "CREATE" || body?.lane === "STUDIO" ? body.lane : existing.lane,
      })
      .where(eq(merchProjects.id, id));
    const [item] = await db.select().from(merchProjects).where(eq(merchProjects.id, id)).limit(1);
    return NextResponse.json(item);
  } catch {
    const item = merchStore.projects.find((p) => p.id === id);
    if (!item) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (typeof body?.name === "string" && body.name.trim()) {
      item.name = body.name.trim();
    }
    if (body?.lane === "CREATE" || body?.lane === "STUDIO") {
      item.lane = body.lane;
    }
    updateTimestamp(item);
    return NextResponse.json(item);
  }
}

