import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureOfferTables } from "@/lib/db/offers-ensure";
import { offers } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

/** Get a single offer. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = await getDb();
    await ensureOfferTables();

    const [row] = await db.select().from(offers).where(and(eq(offers.id, id), eq(offers.userId, userId)));

    if (!row) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    return NextResponse.json({ offer: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("offers [id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch offer" }, { status: 500 });
  }
}

/** Update an offer. */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const db = await getDb();
    await ensureOfferTables();

    const [existing] = await db.select().from(offers).where(and(eq(offers.id, id), eq(offers.userId, userId)));
    if (!existing) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (typeof body?.name === "string") updates.name = body.name.trim().slice(0, 255) || existing.name;
    if (typeof body?.priceRange === "string") updates.priceRange = body.priceRange.trim().slice(0, 64) || null;
    if (typeof body?.promise === "string") updates.promise = body.promise || null;
    if (typeof body?.icp === "string") updates.icp = body.icp || null;
    if (typeof body?.deliverables === "string") updates.deliverables = body.deliverables || null;
    if (typeof body?.guarantee === "string") updates.guarantee = body.guarantee || null;
    if (typeof body?.riskReversal === "string") updates.riskReversal = body.riskReversal || null;
    if (typeof body?.positioning === "string") updates.positioning = body.positioning || null;
    if (typeof body?.proof === "string") updates.proof = body.proof || null;
    if (typeof body?.objections === "string") updates.objections = body.objections || null;
    if (typeof body?.status === "string" && ["draft", "ready", "launched"].includes(body.status)) updates.status = body.status;

    if (Object.keys(updates).length > 0) {
      await db.update(offers).set(updates as any).where(eq(offers.id, id));
    }

    const [updated] = await db.select().from(offers).where(eq(offers.id, id));
    return NextResponse.json({ offer: updated ?? existing });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("offers [id] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update offer" }, { status: 500 });
  }
}

/** Delete an offer. */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = await getDb();
    await ensureOfferTables();

    const [existing] = await db.select().from(offers).where(and(eq(offers.id, id), eq(offers.userId, userId)));
    if (!existing) return NextResponse.json({ error: "Offer not found" }, { status: 404 });

    await db.delete(offers).where(eq(offers.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("offers [id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete offer" }, { status: 500 });
  }
}
