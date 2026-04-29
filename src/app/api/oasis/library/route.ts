import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  oasisAssetPacks,
  oasisElementCategories,
  oasisMarketLicenses,
  oasisMarketListings,
  oasisWorldElements,
  oasisWorlds,
} from "@/lib/db/schema";
import { ensureOasisMarketTables, parseJsonArray } from "@/lib/oasis/market-db";

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ items: [], authenticated: false });

  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);

    const licenses = await db
      .select()
      .from(oasisMarketLicenses)
      .where(and(eq(oasisMarketLicenses.userId, userId), eq(oasisMarketLicenses.status, "active")))
      .orderBy(desc(oasisMarketLicenses.updatedAt));
    if (!licenses.length) return NextResponse.json({ items: [], authenticated: true });

    const worldIds = licenses.filter((l) => l.itemType === "world").map((l) => l.itemRefId);
    const packIds = licenses.filter((l) => l.itemType === "pack").map((l) => l.itemRefId);
    const objectIds = licenses
      .filter((l) => l.itemType === "object")
      .map((l) => Number(l.itemRefId))
      .filter((id) => Number.isFinite(id) && id > 0);

    const [worlds, packs, elements, categories, listings] = await Promise.all([
      worldIds.length
        ? db.select().from(oasisWorlds).where(inArray(oasisWorlds.id, worldIds))
        : Promise.resolve([]),
      packIds.length
        ? db.select().from(oasisAssetPacks).where(inArray(oasisAssetPacks.id, packIds))
        : Promise.resolve([]),
      objectIds.length
        ? db.select().from(oasisWorldElements).where(inArray(oasisWorldElements.id, objectIds))
        : Promise.resolve([]),
      db.select().from(oasisElementCategories),
      db.select().from(oasisMarketListings),
    ]);

    const worldById = new Map(worlds.map((w) => [w.id, w]));
    const packById = new Map(packs.map((p) => [p.id, p]));
    const elementById = new Map(elements.map((e) => [String(e.id), e]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const listingByItem = new Map(listings.map((l) => [`${l.itemType}:${l.itemRefId}`, l]));

    const items = licenses
      .map((license) => {
        const key = `${license.itemType}:${license.itemRefId}`;
        const listing = listingByItem.get(key) ?? null;
        if (license.itemType === "world") {
          const world = worldById.get(license.itemRefId);
          if (!world) return null;
          return {
            licenseId: license.id,
            itemType: "world",
            itemRefId: world.id,
            title: listing?.title || world.name,
            subtitle: listing?.subtitle || world.summary,
            description: listing?.description || world.description,
            previewImageUri: listing?.previewImageUri || world.previewImageUri,
            modelUri: world.modelUri,
            engine: listing?.engine || world.engine,
            tags: parseJsonArray(world.tags),
            acquiredAt: license.createdAt,
          };
        }
        if (license.itemType === "pack") {
          const pack = packById.get(license.itemRefId);
          if (!pack) return null;
          return {
            licenseId: license.id,
            itemType: "pack",
            itemRefId: pack.id,
            title: listing?.title || pack.name,
            subtitle: listing?.subtitle || pack.summary,
            description: listing?.description || pack.description,
            previewImageUri: listing?.previewImageUri || pack.previewImageUri,
            engine: listing?.engine || pack.engine,
            packManifestUri: pack.packManifestUri,
            includedElementIds: parseJsonArray<number>(pack.includedElementIds),
            tags: parseJsonArray(pack.tags),
            acquiredAt: license.createdAt,
          };
        }

        const element = elementById.get(license.itemRefId);
        if (!element) return null;
        const category = categoryById.get(element.categoryId);
        return {
          licenseId: license.id,
          itemType: "object",
          itemRefId: String(element.id),
          title: listing?.title || element.name,
          subtitle: listing?.subtitle || category?.name || null,
          description: listing?.description || element.description,
          previewImageUri: listing?.previewImageUri || element.previewImageUri,
          modelUri: element.assetUri,
          engine: listing?.engine || "universal",
          tags: [],
          acquiredAt: license.createdAt,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items, authenticated: true });
  } catch (error) {
    console.error("oasis/library GET failed", error);
    return NextResponse.json({ error: "Failed to load library" }, { status: 500 });
  }
}
