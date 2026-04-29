import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { crm_tasks } from "@/lib/db/schema";
import { requireUserId } from "@/lib/auth";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { getDb } from "@/lib/db";
import { randomUUID } from "crypto";

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export async function GET(req: NextRequest) {
  let uid: number;
  try {
    uid = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureCrmTables();
    const db = await getDb();

    const url = req.nextUrl ?? new URL(req.url);
    const status = (url.searchParams.get("status") ?? "open").toLowerCase();
    const contactId = url.searchParams.get("contactId");
    const limit = clampInt(url.searchParams.get("limit"), 50, 1, 200);

    const where = [eq(crm_tasks.userId, uid)];
    if (contactId) where.push(eq(crm_tasks.contactId, contactId));
    if (status !== "all") where.push(eq(crm_tasks.status, status));

    const rows = await db
      .select()
      .from(crm_tasks)
      .where(and(...where))
      .orderBy(desc(crm_tasks.dueAt), desc(crm_tasks.createdAt))
      .limit(limit);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const items = rows.map((t) => {
      const due = t.dueAt ? new Date(t.dueAt) : null;
      let dueStr = "—";
      if (due) {
        const d = new Date(due);
        d.setHours(0, 0, 0, 0);
        if (d.getTime() === today.getTime()) dueStr = "Today";
        else if (d.getTime() === tomorrow.getTime()) dueStr = "Tomorrow";
        else if (d > tomorrow) dueStr = "This week";
        else dueStr = due.toLocaleDateString();
      }
      const priorityDisplay =
        t.priority === "high" || t.priority === "urgent"
          ? "High"
          : t.priority === "low"
            ? "Low"
            : "Med";
      return {
        ...t,
        dueAt: t.dueAt instanceof Date ? t.dueAt.toISOString() : t.dueAt,
        createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
        updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
        due: dueStr,
        priority: priorityDisplay,
      };
    });

    return NextResponse.json({
      items,
      tasks: items.map((t) => ({
        id: t.id,
        title: t.title,
        due: t.due,
        priority: t.priority,
      })),
    });
  } catch (err) {
    console.error("tasks GET error:", err);
    return NextResponse.json({ error: "Failed to list tasks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let uid: number;
  try {
    uid = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body?.title ?? "").trim().slice(0, 255);
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const contactId = body?.contactId ? String(body.contactId) : null;
  const description = typeof body?.description === "string" ? body.description : null;

  const priorityRaw = typeof body?.priority === "string" ? body.priority.toLowerCase().trim() : "normal";
  const priority = ["low", "normal", "high", "urgent"].includes(priorityRaw) ? priorityRaw : "normal";

  let dueAt: Date | null = null;
  if (body?.dueAt) {
    const d = new Date(String(body.dueAt));
    if (Number.isFinite(d.getTime())) dueAt = d;
  }

  try {
    await ensureCrmTables();
    const db = await getDb();

    const id = randomUUID();

    const now = new Date();
    await db.insert(crm_tasks).values({
      id,
      userId: uid,
      contactId: contactId ?? undefined,
      title,
      description: description ?? undefined,
      dueAt: dueAt ?? undefined,
      status: "open",
      priority,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("tasks POST error:", err);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
