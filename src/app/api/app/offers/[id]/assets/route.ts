import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureOfferTables } from "@/lib/db/offers-ensure";
import { offerAssets, offers } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

/** Get latest assets for an offer. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = await getDb();
    await ensureOfferTables();

    const [offer] = await db.select().from(offers).where(and(eq(offers.id, id), eq(offers.userId, userId)));
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    const rows = await db.select().from(offerAssets).where(eq(offerAssets.offerId, id)).orderBy(desc(offerAssets.version)).limit(1);
    const assets = rows[0] ?? null;

    return NextResponse.json({ assets });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("offers [id] assets GET error:", err);
    return NextResponse.json({ error: "Failed to fetch assets" }, { status: 500 });
  }
}
