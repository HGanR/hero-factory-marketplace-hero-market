import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { crm_tasks } from "@/lib/db/schema";
import { requireUserId } from "@/lib/auth";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { getDb } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: number;
  try {
    uid = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body?.title === "string") patch.title = body.title.trim().slice(0, 255);
  if (typeof body?.description === "string") patch.description = body.description;

  if (typeof body?.priority === "string") {
    const p = body.priority.toLowerCase().trim();
    patch.priority = ["low", "normal", "high", "urgent"].includes(p) ? p : "normal";
  }

  if (body?.dueAt !== undefined) {
    if (body.dueAt === null || body.dueAt === "") {
      patch.dueAt = null;
    } else {
      const d = new Date(String(body.dueAt));
      if (!Number.isFinite(d.getTime())) {
        return NextResponse.json({ error: "Invalid dueAt" }, { status: 400 });
      }
      patch.dueAt = d;
    }
  }

  if (typeof body?.status === "string") {
    const s = body.status.toLowerCase().trim();
    if (!["open", "completed"].includes(s)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    patch.status = s;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [existing] = await db
      .select({ id: crm_tasks.id })
      .from(crm_tasks)
      .where(and(eq(crm_tasks.id, id), eq(crm_tasks.userId, uid)))
      .limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db
      .update(crm_tasks)
      .set(patch)
      .where(and(eq(crm_tasks.id, id), eq(crm_tasks.userId, uid)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tasks PATCH error:", err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: number;
  try {
    uid = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [existing] = await db
      .select({ id: crm_tasks.id })
      .from(crm_tasks)
      .where(and(eq(crm_tasks.id, id), eq(crm_tasks.userId, uid)))
      .limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.delete(crm_tasks).where(and(eq(crm_tasks.id, id), eq(crm_tasks.userId, uid)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("tasks DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
