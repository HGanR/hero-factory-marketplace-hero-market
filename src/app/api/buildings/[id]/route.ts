import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oasisBuildings } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const db = await getDb();
  const rows = await db
    .select()
    .from(oasisBuildings)
    .where(and(eq(oasisBuildings.id, id), eq(oasisBuildings.userId, userId)))
    .limit(1);

  if (!rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id } = await context.params;

  const db = await getDb();
  const existing = await db
    .select()
    .from(oasisBuildings)
    .where(and(eq(oasisBuildings.id, id), eq(oasisBuildings.userId, userId)))
    .limit(1);
  if (!existing[0]) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: any = {};
  if (body?.name !== undefined) patch.name = String(body.name);
  if (body?.type !== undefined) patch.type = body.type;
  if (body?.description !== undefined) patch.description = body.description ? String(body.description) : null;
  if (body?.data !== undefined) patch.data = String(body.data);
  if (body?.thumbnail !== undefined) patch.thumbnail = body.thumbnail ? String(body.thumbnail) : null;
  if (body?.isPublic !== undefined) patch.isPublic = !!body.isPublic;
  if (body?.tags !== undefined) patch.tags = typeof body.tags === "string" ? body.tags : JSON.stringify(body.tags ?? []);
  if (body?.metadata !== undefined) patch.metadata = body.metadata ? JSON.stringify(body.metadata) : null;

  // bump version (server authoritative)
  patch.version = (existing[0] as any).version + 1;

  await db
    .update(oasisBuildings)
    .set(patch)
    .where(and(eq(oasisBuildings.id, id), eq(oasisBuildings.userId, userId)));

  const updated = await db
    .select()
    .from(oasisBuildings)
    .where(and(eq(oasisBuildings.id, id), eq(oasisBuildings.userId, userId)))
    .limit(1);

  return NextResponse.json(updated[0]);
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const db = await getDb();
  await db
    .delete(oasisBuildings)
    .where(and(eq(oasisBuildings.id, id), eq(oasisBuildings.userId, userId)));

  return NextResponse.json({ success: true });
}


