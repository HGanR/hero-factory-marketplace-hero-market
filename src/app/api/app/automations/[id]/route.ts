import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { randomUUID } from "crypto";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [aRow] = (await db.execute(sql`
      SELECT id, name, isActive, createdAt FROM crm_automations
      WHERE id = ${id} AND userId = ${user.userId}
    `)) as any;
    const a = Array.isArray(aRow) ? aRow[0] : aRow?.rows?.[0] ?? aRow;
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const triggers = (await db.execute(sql`
      SELECT id, type, config FROM crm_automation_triggers WHERE automationId = ${id}
    `)) as any;
    const tArr = Array.isArray(triggers) ? triggers : triggers?.rows ?? triggers;

    const steps = (await db.execute(sql`
      SELECT id, sortOrder, type, config FROM crm_automation_steps WHERE automationId = ${id} ORDER BY sortOrder ASC
    `)) as any;
    const sArr = Array.isArray(steps) ? steps : steps?.rows ?? steps;

    const runs = (await db.execute(sql`
      SELECT id, contactId, status, triggeredAt, completedAt FROM crm_automation_runs
      WHERE automationId = ${id} ORDER BY triggeredAt DESC LIMIT 20
    `)) as any;
    const rArr = Array.isArray(runs) ? runs : runs?.rows ?? runs;

    return NextResponse.json({
      automation: {
        id: a.id,
        name: a.name,
        isActive: !!a.isActive,
        createdAt: a.createdAt,
        triggers: (Array.isArray(tArr) ? tArr : []).map((t: any) => ({
          id: t.id,
          type: t.type,
          config: t.config ?? {},
        })),
        steps: (Array.isArray(sArr) ? sArr : []).map((s: any) => ({
          id: s.id,
          sortOrder: s.sortOrder,
          type: s.type,
          config: typeof s.config === "string" ? (() => { try { return JSON.parse(s.config); } catch { return {}; } })() : (s.config ?? {}),
        })),
        recentRuns: (Array.isArray(rArr) ? rArr : []).map((r: any) => ({
          id: r.id,
          contactId: r.contactId,
          status: r.status,
          triggeredAt: r.triggeredAt,
          completedAt: r.completedAt,
        })),
      },
    });
  } catch (err) {
    console.error("automations [id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch automation" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: { name?: string; isActive?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sets: ReturnType<typeof sql>[] = [];
  if (body.name !== undefined) sets.push(sql`name = ${String(body.name).trim()}`);
  if (body.isActive !== undefined) sets.push(sql`isActive = ${!!body.isActive}`);
  if (sets.length === 0) return NextResponse.json({ error: "No updates" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();
    await db.execute(sql`
      UPDATE crm_automations SET ${sql.join(sets, sql`, `)}, updatedAt = NOW() WHERE id = ${id} AND userId = ${user.userId}
    `);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("automations [id] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();
    await db.execute(sql`DELETE FROM crm_automation_triggers WHERE automationId = ${id}`);
    await db.execute(sql`DELETE FROM crm_automation_steps WHERE automationId = ${id}`);
    await db.execute(sql`DELETE FROM crm_automations WHERE id = ${id} AND userId = ${user.userId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("automations [id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
