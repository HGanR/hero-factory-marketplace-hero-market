import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { nftCollections, nfts, nftSales } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const db = await getDb();
    const collections = await db.select().from(nftCollections).where(eq(nftCollections.isPublic, true));

    const updates: Array<{ id: string; totalSupply: number; floorPrice: string | null; volumeTraded: string | null }> = [];

    for (const c of collections as any[]) {
      const [supplyRows] = await db
        .select({ count: sql<number>`count(${nfts.id})` })
        .from(nfts)
        .where(eq(nfts.collectionId, c.id));
      const totalSupply = Number(supplyRows?.count ?? 0);

      const [floorRows] = await db
        .select({ minPrice: sql<string | null>`min(${nfts.listPrice})` })
        .from(nfts)
        .where(and(eq(nfts.collectionId, c.id), eq(nfts.isListed, true)));
      const floorPrice = floorRows?.minPrice ?? null;

      const [volumeRows] = await db
        .select({ sumPrice: sql<string | null>`sum(${nftSales.price})` })
        .from(nftSales)
        .innerJoin(nfts, eq(nftSales.nftId, nfts.id))
        .where(eq(nfts.collectionId, c.id));
      const volumeTraded = volumeRows?.sumPrice ?? null;

      updates.push({ id: c.id, totalSupply, floorPrice, volumeTraded });
    }

    for (const u of updates) {
      await db.update(nftCollections).set({
        totalSupply: u.totalSupply,
        floorPrice: u.floorPrice,
        volumeTraded: u.volumeTraded || "0",
      } as any).where(eq(nftCollections.id, u.id));
    }

    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (error: any) {
    console.error("Public collections sync error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to sync public collections" } },
      { status: 500 }
    );
  }
}
