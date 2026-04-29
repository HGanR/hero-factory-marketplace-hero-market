import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
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

export async function GET(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50") || 50));
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0") || 0);

  const db = await getDb();
  const rows = await db
    .select()
    .from(oasisBuildings)
    .where(eq(oasisBuildings.userId, userId))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body?.id || !body?.name || !body?.type || !body?.data) {
    return NextResponse.json({ error: "Missing required fields: id, name, type, data" }, { status: 400 });
  }

  const db = await getDb();

  const record = {
    id: String(body.id),
    userId,
    name: String(body.name),
    type: body.type,
    description: body.description ? String(body.description) : null,
    data: String(body.data),
    thumbnail: body.thumbnail ? String(body.thumbnail) : null,
    version: typeof body.version === "number" ? body.version : 1,
    isPublic: !!body.isPublic,
    tags: typeof body.tags === "string" ? body.tags : JSON.stringify(body.tags ?? []),
    metadata: body.metadata ? JSON.stringify(body.metadata) : null,
  } as any;

  await db.insert(oasisBuildings).values(record);

  const saved = await db.select().from(oasisBuildings).where(eq(oasisBuildings.id, record.id)).limit(1);
  return NextResponse.json(saved[0] ?? record);
}


