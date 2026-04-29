import { NextResponse } from "next/server";
import { makeId, merchStore } from "@/lib/merch/mock-db";
import { CreateAssetSchema } from "@/lib/zod/asset";
import { getDb } from "@/lib/db";
import { merchAssets } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";

const nowIso = () => new Date().toISOString();

export async function GET() {
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const userId = (await getAuthedUserId()) ?? 1;
    const items = await db.select().from(merchAssets).where(eq(merchAssets.userId, userId)).orderBy(desc(merchAssets.createdAt));
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: merchStore.assets });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = CreateAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const payload = parsed.data;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const userId = (await getAuthedUserId()) ?? 1;
    const id = makeId("asset");
    await db.insert(merchAssets).values({
      id,
      userId,
      type: payload.type,
      name: payload.name,
      url: payload.url,
      metadataJson: payload.metadataJson || {},
    });
    const [item] = await db.select().from(merchAssets).where(eq(merchAssets.id, id)).limit(1);
    return NextResponse.json(item, { status: 201 });
  } catch {
    const item = {
      id: makeId("asset"),
      ownerId: payload.ownerId || "demo-owner",
      type: payload.type,
      name: payload.name,
      url: payload.url,
      metadataJson: payload.metadataJson || {},
      createdAt: nowIso(),
    };
    merchStore.assets.unshift(item);
    return NextResponse.json(item, { status: 201 });
  }
}

