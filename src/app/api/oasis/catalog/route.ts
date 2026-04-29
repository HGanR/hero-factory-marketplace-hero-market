import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  oasisAssetPacks,
  oasisElementCategories,
  oasisMarketListings,
  oasisWorldElements,
  oasisWorlds,
} from "@/lib/db/schema";
import { ensureOasisMarketTables } from "@/lib/oasis/market-db";

type CatalogType = "world" | "object" | "pack";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);
    const { searchParams } = new URL(request.url);
    const type = String(searchParams.get("type") || "all").toLowerCase();
    const engineFilter = String(searchParams.get("engine") || "all").toLowerCase();

    const listings = await db
      .select()
      .from(oasisMarketListings)
      .where(eq(oasisMarketListings.isPublished, true))
      .orderBy(desc(oasisMarketListings.updatedAt));

    const worlds = await db.select().from(oasisWorlds).where(eq(oasisWorlds.isPublished, true));
    const packs = await db.select().from(oasisAssetPacks).where(eq(oasisAssetPacks.isPublished, true));
    const categories = await db.select().from(oasisElementCategories);
    const elements = await db.select().from(oasisWorldElements).orderBy(desc(oasisWorldElements.updatedAt));

    const worldById = new Map(worlds.map((w) => [w.id, w]));
    const packById = new Map(packs.map((p) => [p.id, p]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const listingByObjectRef = new Map(
      listings.filter((l) => l.itemType === "object").map((l) => [l.itemRefId, l])
    );

    const worldItems = listings
      .filter((l) => l.itemType === "world")
      .map((listing) => {
        const world = worldById.get(listing.itemRefId);
        if (!world) return null;
        return {
          id: `world:${world.id}`,
          itemType: "world" as CatalogType,
          itemRefId: world.id,
          title: listing.title || world.name,
          subtitle: listing.subtitle || world.summary,
          description: listing.description || world.description,
          previewImageUri: listing.previewImageUri || world.previewImageUri,
          modelUri: world.modelUri,
          engine: listing.engine || world.engine,
          price: listing.price,
          currency: listing.currency,
          tags: world.tags,
          source: "listing",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const packItems = listings
      .filter((l) => l.itemType === "pack")
      .map((listing) => {
        const pack = packById.get(listing.itemRefId);
        if (!pack) return null;
        return {
          id: `pack:${pack.id}`,
          itemType: "pack" as CatalogType,
          itemRefId: pack.id,
          title: listing.title || pack.name,
          subtitle: listing.subtitle || pack.summary,
          description: listing.description || pack.description,
          previewImageUri: listing.previewImageUri || pack.previewImageUri,
          engine: listing.engine || pack.engine,
          packManifestUri: pack.packManifestUri,
          includedElementIds: pack.includedElementIds,
          price: listing.price,
          currency: listing.currency,
          tags: pack.tags,
          source: "listing",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const objectItems = elements.map((element) => {
      const listing = listingByObjectRef.get(String(element.id));
      const category = categoryById.get(element.categoryId);
      return {
        id: `object:${element.id}`,
        itemType: "object" as CatalogType,
        itemRefId: String(element.id),
        title: listing?.title || element.name,
        subtitle: listing?.subtitle || category?.name || null,
        description: listing?.description || element.description,
        previewImageUri: listing?.previewImageUri || element.previewImageUri,
        modelUri: element.assetUri,
        engine: listing?.engine || "universal",
        price: listing?.price || element.price,
        currency: listing?.currency || element.currency,
        source: listing ? "listing" : "element",
      };
    });

    const merged = [...worldItems, ...objectItems, ...packItems];
    const filteredByType =
      type === "world" || type === "object" || type === "pack"
        ? merged.filter((item) => item.itemType === type)
        : merged;

    const filteredByEngine =
      engineFilter === "all"
        ? filteredByType
        : filteredByType.filter((item) => String(item.engine || "").toLowerCase() === engineFilter);

    return NextResponse.json({
      items: filteredByEngine,
      counts: {
        worlds: worldItems.length,
        objects: objectItems.length,
        packs: packItems.length,
      },
    });
  } catch (error) {
    console.error("oasis/catalog GET failed", error);
    return NextResponse.json({ error: "Failed to load Oasis catalog" }, { status: 500 });
  }
}
