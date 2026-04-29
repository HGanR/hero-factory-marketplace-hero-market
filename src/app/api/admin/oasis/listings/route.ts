import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { oasisMarketListings } from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";

const CURRENCIES = ["TROO", "TROO_POO", "XRP", "SOL", "POL", "BTC", "ETH", "BNB", "USDC"] as const;
const ENGINES = ["unity", "unreal", "webgl", "custom", "universal"] as const;
const ITEM_TYPES = ["world", "object", "pack"] as const;

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);
    const listings = await db.select().from(oasisMarketListings).orderBy(desc(oasisMarketListings.updatedAt));
    return NextResponse.json({ listings });
  } catch (error) {
    console.error("admin/oasis/listings GET failed", error);
    return NextResponse.json({ error: "Failed to list listings" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const itemTypeRaw = String(body?.itemType ?? "").toLowerCase();
    const itemType = ITEM_TYPES.includes(itemTypeRaw as (typeof ITEM_TYPES)[number])
      ? (itemTypeRaw as (typeof ITEM_TYPES)[number])
      : null;
    const itemRefId = String(body?.itemRefId ?? "").trim();
    const title = String(body?.title ?? "").trim();
    const subtitle = String(body?.subtitle ?? "").trim() || null;
    const description = String(body?.description ?? "").trim() || null;
    const previewImageUri = String(body?.previewImageUri ?? "").trim() || null;
    const isPublished = Boolean(body?.isPublished ?? false);
    const engineRaw = String(body?.engine ?? "universal").toLowerCase();
    const engine = ENGINES.includes(engineRaw as (typeof ENGINES)[number])
      ? (engineRaw as (typeof ENGINES)[number])
      : "universal";
    const priceRaw = Number(body?.price ?? 0);
    const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? String(priceRaw) : "0";
    const currencyRaw = String(body?.currency ?? "TROO").toUpperCase();
    const currency = CURRENCIES.includes(currencyRaw as (typeof CURRENCIES)[number])
      ? (currencyRaw as (typeof CURRENCIES)[number])
      : "TROO";

    if (!itemType) return NextResponse.json({ error: "itemType must be world/object/pack" }, { status: 400 });
    if (!itemRefId) return NextResponse.json({ error: "itemRefId is required" }, { status: 400 });
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });

    const db = await getDb();
    await ensureOasisMarketTables(db);
    const adminUserId = Number((admin as any).userId ?? (admin as any).id ?? 0);

    const [existing] = await db
      .select()
      .from(oasisMarketListings)
      .where(and(eq(oasisMarketListings.itemType, itemType), eq(oasisMarketListings.itemRefId, itemRefId)))
      .limit(1);

    if (existing) {
      await db
        .update(oasisMarketListings)
        .set({ title, subtitle, description, previewImageUri, engine, price, currency, isPublished })
        .where(eq(oasisMarketListings.id, existing.id));
      return NextResponse.json({ ok: true, listingId: existing.id, updated: true });
    }

    const id = crypto.randomUUID();
    await db.insert(oasisMarketListings).values({
      id,
      itemType,
      itemRefId,
      title,
      subtitle,
      description,
      previewImageUri,
      engine,
      price,
      currency,
      isPublished,
      createdByUserId: adminUserId,
    });
    return NextResponse.json({ ok: true, listingId: id, created: true }, { status: 201 });
  } catch (error) {
    console.error("admin/oasis/listings POST failed", error);
    return NextResponse.json({ error: "Failed to save listing" }, { status: 500 });
  }
}
