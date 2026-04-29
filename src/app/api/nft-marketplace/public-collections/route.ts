import { NextRequest, NextResponse } from "next/server";
import { getConnection, getDb } from "@/lib/db";
import { nftCollections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chain = searchParams.get("chain") || "all";

    const connection = await getConnection();
    let hasIsPublic = true;
    try {
      const [rows] = await connection.query(
        "SELECT COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'nft_collections'"
      );
      const cols = new Set(
        Array.isArray(rows)
          ? rows.map((r: any) => r.columnName || r.COLUMN_NAME).filter(Boolean)
          : []
      );
      hasIsPublic = cols.has("isPublic");
    } catch {
      hasIsPublic = false;
    }

    const db = await getDb();
    let query = db.select().from(nftCollections);
    if (chain !== "all") {
      query = query.where(eq(nftCollections.chain, chain as any)) as any;
    }
    if (hasIsPublic) {
      query = query.where(eq(nftCollections.isPublic, true)) as any;
    }

    const collections = await query;

    return NextResponse.json({
      ok: true,
      collections: collections.map((c: any) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        chain: c.chain,
        contractAddress: c.contractAddress,
        imageUrl: c.imageUrl || null,
        description: c.description || "",
      })),
    });
  } catch (error: any) {
    console.error("Public collections error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch collections" } },
      { status: 500 }
    );
  }
}
