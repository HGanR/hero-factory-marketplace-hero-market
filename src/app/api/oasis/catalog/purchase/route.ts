import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  oasisAssetPacks,
  oasisMarketLicenses,
  oasisMarketListings,
  oasisMarketPurchases,
  oasisWorldElements,
  oasisWorlds,
} from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";

const ITEM_TYPES = ["world", "object", "pack"] as const;
const CURRENCIES = ["TROO", "TROO_POO", "XRP", "SOL", "POL", "BTC", "ETH", "BNB", "USDC"] as const;

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const itemTypeRaw = String(body?.itemType ?? "").toLowerCase();
    const itemType = ITEM_TYPES.includes(itemTypeRaw as (typeof ITEM_TYPES)[number])
      ? (itemTypeRaw as (typeof ITEM_TYPES)[number])
      : null;
    const itemRefId = String(body?.itemRefId ?? "").trim();
    const txHash = String(body?.txHash ?? "").trim() || null;
    const amountRaw = Number(body?.amount ?? body?.price ?? 0);
    const amount = Number.isFinite(amountRaw) && amountRaw >= 0 ? String(amountRaw) : "0";
    const currencyRaw = String(body?.currency ?? "TROO").toUpperCase();
    const currency = CURRENCIES.includes(currencyRaw as (typeof CURRENCIES)[number])
      ? (currencyRaw as (typeof CURRENCIES)[number])
      : "TROO";

    if (!itemType) return NextResponse.json({ error: "itemType must be world/object/pack" }, { status: 400 });
    if (!itemRefId) return NextResponse.json({ error: "itemRefId is required" }, { status: 400 });

    const db = await getDb();
    await ensureOasisMarketTables(db);

    const [existingLicense] = await db
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
    if (existingLicense) {
      return NextResponse.json({ ok: true, alreadyOwned: true, licenseId: existingLicense.id });
    }

    const [listing] = await db
      .select()
      .from(oasisMarketListings)
      .where(
        and(
          eq(oasisMarketListings.itemType, itemType),
          eq(oasisMarketListings.itemRefId, itemRefId),
          eq(oasisMarketListings.isPublished, true)
        )
      )
      .limit(1);

    // Ensure referenced item exists (for object, listing can still be optional).
    if (itemType === "world") {
      const [world] = await db
        .select({ id: oasisWorlds.id })
        .from(oasisWorlds)
        .where(and(eq(oasisWorlds.id, itemRefId), eq(oasisWorlds.isPublished, true)))
        .limit(1);
      if (!world) return NextResponse.json({ error: "World not available" }, { status: 404 });
      if (!listing) return NextResponse.json({ error: "World listing not published" }, { status: 400 });
    } else if (itemType === "pack") {
      const [pack] = await db
        .select({ id: oasisAssetPacks.id })
        .from(oasisAssetPacks)
        .where(and(eq(oasisAssetPacks.id, itemRefId), eq(oasisAssetPacks.isPublished, true)))
        .limit(1);
      if (!pack) return NextResponse.json({ error: "Pack not available" }, { status: 404 });
      if (!listing) return NextResponse.json({ error: "Pack listing not published" }, { status: 400 });
    } else {
      const objectId = Number(itemRefId);
      if (!Number.isFinite(objectId) || objectId <= 0) {
        return NextResponse.json({ error: "Object itemRefId must be numeric" }, { status: 400 });
      }
      const [element] = await db
        .select({ id: oasisWorldElements.id })
        .from(oasisWorldElements)
        .where(eq(oasisWorldElements.id, objectId))
        .limit(1);
      if (!element) return NextResponse.json({ error: "Object not available" }, { status: 404 });
    }

    const purchaseId = crypto.randomUUID();
    await db.insert(oasisMarketPurchases).values({
      id: purchaseId,
      userId,
      itemType,
      itemRefId,
      listingId: listing?.id ?? null,
      txHash,
      amount,
      currency,
      metadata: JSON.stringify({ source: "api/oasis/catalog/purchase" }),
    });

    const licenseId = crypto.randomUUID();
    await db.insert(oasisMarketLicenses).values({
      id: licenseId,
      userId,
      itemType,
      itemRefId,
      purchaseId,
      status: "active",
    });

    return NextResponse.json({ ok: true, licenseId, purchaseId, alreadyOwned: false }, { status: 201 });
  } catch (error) {
    console.error("oasis/catalog/purchase POST failed", error);
    return NextResponse.json({ error: "Failed to complete purchase" }, { status: 500 });
  }
}
