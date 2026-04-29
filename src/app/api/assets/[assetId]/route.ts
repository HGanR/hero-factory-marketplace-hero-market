import { NextResponse } from "next/server";
import { merchStore } from "@/lib/merch/mock-db";
import { getDb } from "@/lib/db";
import { merchAssets } from "@/lib/db/schema";
import { ensureMerchTables } from "@/lib/merch/db";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ assetId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { assetId } = await params;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    const [item] = await db.select().from(merchAssets).where(eq(merchAssets.id, assetId)).limit(1);
    if (item) {
      return NextResponse.json(item);
    }
  } catch {
    // fallback below
  }
  const item = merchStore.assets.find((a) => a.id === assetId);
  if (!item) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { assetId } = await params;
  try {
    const db = await getDb();
    await ensureMerchTables(db);
    await db.delete(merchAssets).where(eq(merchAssets.id, assetId));
    return NextResponse.json({ deleted: 1 });
  } catch {
    const before = merchStore.assets.length;
    merchStore.assets = merchStore.assets.filter((a) => a.id !== assetId);
    return NextResponse.json({ deleted: before - merchStore.assets.length });
  }
}

