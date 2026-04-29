import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureOfferTables } from "@/lib/db/offers-ensure";
import { offers } from "@/lib/db/schema";
import { fireAutomation } from "@/lib/automations/runner";

/** List offers for the current user. */
export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const db = await getDb();
    await ensureOfferTables();

    const rows = await db.select().from(offers).where(eq(offers.userId, userId)).orderBy(desc(offers.updatedAt));

    return NextResponse.json({ offers: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("offers GET error:", err);
    return NextResponse.json({ error: "Failed to list offers" }, { status: 500 });
  }
}

/** Create a new offer. */
export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "New Offer").trim().slice(0, 255) || "New Offer";

    const db = await getDb();
    await ensureOfferTables();

    const id = crypto.randomUUID();
    await db.insert(offers).values({
      id,
      userId,
      name,
      status: "draft",
    });

    const [row] = await db.select().from(offers).where(eq(offers.id, id));
    const offer = row ?? { id, userId, name, status: "draft" };

    try {
      await fireAutomation("offer_created", {
        metadata: { offerId: id, offerName: name, userId },
      });
    } catch (e) {
      console.warn("offer_created automation fire failed:", e);
    }

    return NextResponse.json({ offer }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("offers POST error:", err);
    return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
  }
}
