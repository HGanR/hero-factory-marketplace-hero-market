/**
 * GET /api/worlds/platform-zone — All active published platform zones (public, cacheable)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { platformGlobalZones, platformGlobalZoneVersions } from "@/lib/db/schema.worlds";

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();

    const zones = await db
      .select()
      .from(platformGlobalZones)
      .where(eq(platformGlobalZones.isActive, true))
      .orderBy(platformGlobalZones.priority);

    const result: Array<{
      id: string;
      name: string;
      slug: string;
      boundsJson: unknown;
      placementsJson: unknown;
      npcsJson: unknown;
      priority: number;
    }> = [];

    for (const zone of zones) {
      const [published] = await db
        .select()
        .from(platformGlobalZoneVersions)
        .where(
          and(
            eq(platformGlobalZoneVersions.zoneId, zone.id),
            eq(platformGlobalZoneVersions.versionType, "published")
          )
        )
        .orderBy(desc(platformGlobalZoneVersions.versionNumber))
        .limit(1);

      result.push({
        id: zone.id,
        name: zone.name,
        slug: zone.slug,
        boundsJson: zone.boundsJson,
        placementsJson: published?.placementsJson ?? zone.placementsJson,
        npcsJson: published?.npcsJson ?? zone.npcsJson,
        priority: zone.priority ?? 0,
      });
    }

    return NextResponse.json({ zones: result });
  } catch (e) {
    console.error("[api/worlds/platform-zone GET]", e);
    // Return empty zones so editor can still load when tables are missing
    return NextResponse.json({ zones: [] });
  }
}
