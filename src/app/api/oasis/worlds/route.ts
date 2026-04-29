import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { oasisWorlds } from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";

/**
 * Public API: list published OASIS worlds (for AI World Generator).
 */
export async function GET() {
  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);
    const rows = await db
      .select({ id: oasisWorlds.id, name: oasisWorlds.name, slug: oasisWorlds.slug })
      .from(oasisWorlds)
      .where(eq(oasisWorlds.isPublished, true))
      .orderBy(desc(oasisWorlds.updatedAt));
    return NextResponse.json({ worlds: rows });
  } catch (err) {
    console.error("[oasis/worlds] GET failed", err);
    return NextResponse.json({ error: "Failed to load worlds" }, { status: 500 });
  }
}
