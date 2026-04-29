import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { randomUUID } from "crypto";

function getCurrentUser(req: NextRequest): { userId: number; isAdmin?: boolean } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.userId) return null;
  return { userId: decoded.userId as number, isAdmin: !!decoded.isAdmin };
}

export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureCrmTables();
    const db = await getDb();
    const uid = user.userId;

    const rows = (await db.execute(sql`
      SELECT id, npcId, name, type, phoneNumber, siteId, consultantId, isActive, createdAt
      FROM ai_voice_agents
      WHERE userId = ${uid}
      ORDER BY createdAt DESC
    `)) as any;

    const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows;
    const agents = (Array.isArray(arr) ? arr : []).map((r: any) => ({
      id: r.id,
      npcId: r.npcId ?? null,
      name: r.name ?? "Voice Agent",
      type: r.type ?? "voice",
      phoneNumber: r.phoneNumber ?? null,
      siteId: r.siteId ?? null,
      consultantId: r.consultantId ?? null,
      isActive: !!r.isActive,
      createdAt: r.createdAt ?? null,
    }));

    return NextResponse.json({ agents });
  } catch (err) {
    console.error("voice-agents GET error:", err);
    return NextResponse.json({ error: "Failed to list voice agents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name: string; npcId?: string; consultantId?: string; siteId?: string; phoneNumber?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const npcId = body.npcId ? String(body.npcId).trim() || null : null;
  const consultantId = body.consultantId ? String(body.consultantId).trim() || null : null;
  const siteId = body.siteId ? String(body.siteId).trim() || null : null;
  const phoneNumber = body.phoneNumber ? String(body.phoneNumber).trim() || null : null;
  const type = (body.type === "chat" ? "chat" : "voice") as "chat" | "voice";

  try {
    await ensureCrmTables();
    const db = await getDb();
    const id = randomUUID();

    await db.execute(sql`
      INSERT INTO ai_voice_agents (id, userId, npcId, name, type, phoneNumber, siteId, consultantId)
      VALUES (${id}, ${user.userId}, ${npcId}, ${name}, ${type}, ${phoneNumber}, ${siteId}, ${consultantId})
    `);

    const [row] = (await db.execute(sql`
      SELECT id, npcId, name, type, phoneNumber, siteId, consultantId, isActive, createdAt
      FROM ai_voice_agents WHERE id = ${id}
    `)) as any;
    const inserted = Array.isArray(row) ? row[0] : row?.rows?.[0] ?? row;

    return NextResponse.json({
      agent: {
        id: inserted?.id ?? id,
        npcId: inserted?.npcId ?? null,
        name: inserted?.name ?? name,
        type: inserted?.type ?? type,
        phoneNumber: inserted?.phoneNumber ?? null,
        siteId: inserted?.siteId ?? null,
        consultantId: inserted?.consultantId ?? null,
        isActive: inserted?.isActive !== false,
        createdAt: inserted?.createdAt ?? null,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("voice-agents POST error:", err);
    return NextResponse.json({ error: "Failed to create voice agent" }, { status: 500 });
  }
}
