/**
 * Explicit airport catalog publication. Never modifies an existing asset or
 * changes any world placement, scale, rotation, or saved scene.
 *
 * Usage (after the verified GLB is committed and database credentials are set):
 * AIRPORT_TOKEN_PRICE=... node --import tsx scripts/publish-airport-asset.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { worldLibraryAssets } from "../src/lib/db/schema.worlds";

export const AIRPORT_ASSET_SLUG = "airport-cycle-30min";
export const AIRPORT_MODEL_URL = "/models/world-assets/airport_cycle_30min.glb";
export const AIRPORT_EXPECTED_SHA256 = "83ba5e7bb48658831e67f5259f570331465ff5a8bb22bbc1275817e9a8ad43aa";

export function parseAirportPrice(raw: string | undefined): number {
  if (!raw || !/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw new Error("AIRPORT_TOKEN_PRICE must be explicitly set to a nonnegative integer TROO amount");
  }
  const price = Number(raw);
  if (!Number.isSafeInteger(price) || price > 2147483647) {
    throw new Error("AIRPORT_TOKEN_PRICE exceeds database integer bounds");
  }
  return price;
}

export async function verifyAirportModel(path: string): Promise<void> {
  const bytes = await readFile(path);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== AIRPORT_EXPECTED_SHA256) {
    throw new Error("Airport GLB checksum mismatch; refusing to publish or replace the model");
  }
}

async function main() {
  const price = parseAirportPrice(process.env.AIRPORT_TOKEN_PRICE);
  const modelPath = resolve(process.cwd(), "public", AIRPORT_MODEL_URL.slice(1));
  await verifyAirportModel(modelPath);
  const db = await getDb();
  const [existing] = await db.select().from(worldLibraryAssets)
    .where(eq(worldLibraryAssets.slug, AIRPORT_ASSET_SLUG)).limit(1);
  if (existing) {
    // Never overwrite existing metadata, pricing, model reference, or placement settings.
    console.log("Airport catalog entry already exists; no changes made.", existing.id);
    return;
  }
  await db.insert(worldLibraryAssets).values({
    id: randomUUID(),
    slug: AIRPORT_ASSET_SLUG,
    name: "Airport",
    category: "airport",
    description: "Airport model for manual placement and resizing in Green Terrain.",
    status: "published",
    modelUrl: AIRPORT_MODEL_URL,
    collisionType: "box",
    instancable: false,
    tokenPrice: price,
    isPlatformOnly: false,
    isActive: true,
  });
  console.log("Airport published to World Explorer catalog. Existing world placements were not modified.");
}

if (process.argv[1] && /publish-airport-asset\.(ts|js)$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
