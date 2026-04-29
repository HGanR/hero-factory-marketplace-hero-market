import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

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

    const rows = (await db.execute(sql`
      SELECT id, npcId, name, type, phoneNumber, siteId, consultantId, isActive, twilioConfig, createdAt
      FROM ai_voice_agents
      WHERE id = ${id} AND userId = ${user.userId}
    `)) as any;
    const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows;
    const r = Array.isArray(arr) ? arr[0] : arr;

    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({
      agent: {
        id: r.id,
        npcId: r.npcId ?? null,
        name: r.name ?? "Voice Agent",
        type: r.type ?? "voice",
        phoneNumber: r.phoneNumber ?? null,
        siteId: r.siteId ?? null,
        consultantId: r.consultantId ?? null,
        isActive: !!r.isActive,
        twilioConfig: r.twilioConfig ?? null,
        createdAt: r.createdAt ?? null,
      },
    });
  } catch (err) {
    console.error("voice-agents GET [id] error:", err);
    return NextResponse.json({ error: "Failed to fetch voice agent" }, { status: 500 });
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sets: ReturnType<typeof sql>[] = [];
  if (body.name !== undefined) {
    const v = String(body.name).trim();
    if (!v) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    sets.push(sql`name = ${v}`);
  }
  if (body.npcId !== undefined) sets.push(sql`npcId = ${body.npcId ? String(body.npcId).trim() : null}`);
  if (body.consultantId !== undefined) sets.push(sql`consultantId = ${body.consultantId ? String(body.consultantId).trim() : null}`);
  if (body.siteId !== undefined) sets.push(sql`siteId = ${body.siteId ? String(body.siteId).trim() : null}`);
  if (body.phoneNumber !== undefined) sets.push(sql`phoneNumber = ${body.phoneNumber ? String(body.phoneNumber).trim() : null}`);
  if (body.isActive !== undefined) sets.push(sql`isActive = ${!!body.isActive}`);

  if (sets.length === 0) return NextResponse.json({ error: "No updates" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();

    await db.execute(sql`UPDATE ai_voice_agents SET ${sql.join(sets, sql`, `)}, updatedAt = NOW() WHERE id = ${id} AND userId = ${user.userId}`);

    const rows = (await db.execute(sql`
      SELECT id, npcId, name, type, phoneNumber, siteId, consultantId, isActive, updatedAt
      FROM ai_voice_agents WHERE id = ${id} AND userId = ${user.userId}
    `)) as any;
    const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows;
    const r = Array.isArray(arr) ? arr[0] : arr;

    return NextResponse.json({
      agent: r ? {
        id: r.id,
        npcId: r.npcId ?? null,
        name: r.name ?? "Voice Agent",
        type: r.type ?? "voice",
        phoneNumber: r.phoneNumber ?? null,
        siteId: r.siteId ?? null,
        consultantId: r.consultantId ?? null,
        isActive: !!r.isActive,
        updatedAt: r.updatedAt ?? null,
      } : null,
    });
  } catch (err) {
    console.error("voice-agents PATCH error:", err);
    return NextResponse.json({ error: "Failed to update voice agent" }, { status: 500 });
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

    await db.execute(sql`
      DELETE FROM ai_voice_agents WHERE id = ${id} AND userId = ${user.userId}
    `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("voice-agents DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete voice agent" }, { status: 500 });
  }
}
