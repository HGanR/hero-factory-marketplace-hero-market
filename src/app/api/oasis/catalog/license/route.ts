import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { oasisMarketLicenses } from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";

const ITEM_TYPES = ["world", "object", "pack"] as const;

export async function GET(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ owned: false, authenticated: false });

  try {
    const { searchParams } = new URL(request.url);
    const itemTypeRaw = String(searchParams.get("itemType") || "").toLowerCase();
    const itemType = ITEM_TYPES.includes(itemTypeRaw as (typeof ITEM_TYPES)[number])
      ? (itemTypeRaw as (typeof ITEM_TYPES)[number])
      : null;
    const itemRefId = String(searchParams.get("itemRefId") || "").trim();

    if (!itemType || !itemRefId) return NextResponse.json({ owned: false, authenticated: true });

    const db = await getDb();
    await ensureOasisMarketTables(db);
    const [license] = await db
      .select()
      .from(oasisMarketLicenses)
      .where(
        and(
          eq(oasisMarketLicenses.userId, userId),
          eq(oasisMarketLicenses.itemType, itemType),
          eq(oasisMarketLicenses.itemRefId, itemRefId),
          eq(oasisMarketLicenses.status, "active")
        )
      )
      .limit(1);

    return NextResponse.json({
      authenticated: true,
      owned: Boolean(license),
      license: license ?? null,
    });
  } catch (error) {
    console.error("oasis/catalog/license GET failed", error);
    return NextResponse.json({ error: "Failed to check license" }, { status: 500 });
  }
}
