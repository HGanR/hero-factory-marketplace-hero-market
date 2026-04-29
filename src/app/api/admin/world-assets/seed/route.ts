/**
 * POST /api/admin/world-assets/seed
 * Seeds Troo assets (meeting node + buildings) into world_library_assets.
 * Admin only.
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worldLibraryAssets } from "@/lib/db/schema.worlds";
import { trooWorldPlacements } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

const MEETING_NODE = {
  id: "corporate-meeting-node-v1",
  slug: "corporate-meeting-node-v1",
  name: "Corporate Meeting Node v1",
  category: "meeting_node",
  description:
    "Meeting room node for corporate buildings. Place in Nexus, Meridian, Apex, or Harborview towers. Supports web meetings with LiveKit.",
  modelUrl: "procedural:corporate_meeting_node_v1",
  tokenPrice: 7500,
  metadataJson: JSON.stringify({
    compatibleBuildingCategories: ["nexus-tower", "meridian-tower", "apex-tower", "harborview-tower"],
    minCapacity: 2,
    maxCapacity: 50,
    supportedModes: ["web", "webxr", "vr"],
  }),
};

const BUILDINGS = [
  { slug: "nexus-tower", name: "Nexus Tower", modelUrl: "/models/nexus-tower/modern_building.glb", tokenPrice: 5000 },
  { slug: "meridian-tower", name: "Meridian Tower", modelUrl: "/models/meridian-tower/meridian_tower.glb", tokenPrice: 5000 },
  { slug: "apex-tower", name: "Apex Tower", modelUrl: "procedural:apex", tokenPrice: 5000 },
  { slug: "harborview-tower", name: "Harborview Tower", modelUrl: "procedural:harborview", tokenPrice: 5000 },
];

const STADIUM_ELYSEUM = {
  id: "stadium-elyseum",
  slug: "stadium-elyseum",
  name: "Stadium Elyseum",
  category: "venue" as const,
  description:
    "Large stadium venue for concerts, seminars, lectures, and presentations. 500 audience capacity, 3 host slots. Supports avatar mode, VR, live stream.",
  modelUrl: "/models/world-assets/stadium-elyseum.glb",
  tokenPrice: 1_000_000,
  metadataJson: JSON.stringify({
    asset_type: "stadium",
    max_users: 500,
    host_capacity: 3,
    audience_capacity: 500,
    compatible_worlds: ["*"],
    features: ["avatar_mode", "vr_headset", "live_stream", "seminar", "lecture", "concert", "presentation"],
    spawn_nodes: { host: 3, audience: 424, entrance: 4, backstage: 1 },
    screens: ["SCREEN_MAIN", "SCREEN_LEFT", "SCREEN_RIGHT", "SCREEN_SCOREBOARD"],
    vr_cameras: ["VR_CAM_STAGE", "VR_CAM_AUDIENCE", "VR_CAM_AERIAL", "VR_CAM_BACKSTAGE", "VR_CAM_BROADCAST"],
  }),
};

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();

    const seeded: string[] = [];

    // Meeting node
    const [existingNode] = await db
      .select()
      .from(worldLibraryAssets)
      .where(eq(worldLibraryAssets.slug, MEETING_NODE.slug))
      .limit(1);

    if (!existingNode) {
      await db.insert(worldLibraryAssets).values({
        id: MEETING_NODE.id,
        slug: MEETING_NODE.slug,
        name: MEETING_NODE.name,
        category: MEETING_NODE.category,
        description: MEETING_NODE.description,
        status: "published",
        version: 1,
        modelUrl: MEETING_NODE.modelUrl,
        tokenPrice: MEETING_NODE.tokenPrice,
        isPlatformOnly: false,
        isActive: true,
        metadataJson: MEETING_NODE.metadataJson,
      });
      seeded.push(MEETING_NODE.name);
    }

    // Buildings
    for (const b of BUILDINGS) {
      const [existing] = await db
        .select()
        .from(worldLibraryAssets)
        .where(eq(worldLibraryAssets.slug, b.slug))
        .limit(1);

      if (!existing) {
        await db.insert(worldLibraryAssets).values({
          id: b.slug,
          slug: b.slug,
          name: b.name,
          category: "building",
          description:
            "Corporate building for Troo World. Place in your world to host meeting nodes and AI agents.",
          status: "published",
          version: 1,
          modelUrl: b.modelUrl,
          tokenPrice: b.tokenPrice,
          isPlatformOnly: false,
          isActive: true,
        });
        seeded.push(b.name);
      }
    }

    // Stadium Elyseum (venue)
    const [existingStadium] = await db
      .select()
      .from(worldLibraryAssets)
      .where(eq(worldLibraryAssets.slug, STADIUM_ELYSEUM.slug))
      .limit(1);

    if (!existingStadium) {
      await db.insert(worldLibraryAssets).values({
        id: STADIUM_ELYSEUM.id,
        slug: STADIUM_ELYSEUM.slug,
        name: STADIUM_ELYSEUM.name,
        category: STADIUM_ELYSEUM.category,
        description: STADIUM_ELYSEUM.description,
        status: "published",
        version: 1,
        modelUrl: STADIUM_ELYSEUM.modelUrl,
        tokenPrice: STADIUM_ELYSEUM.tokenPrice,
        isPlatformOnly: false,
        isActive: true,
        metadataJson: STADIUM_ELYSEUM.metadataJson,
      });
      seeded.push(STADIUM_ELYSEUM.name);
    } else if (existingStadium.tokenPrice !== STADIUM_ELYSEUM.tokenPrice) {
      await db
        .update(worldLibraryAssets)
        .set({ tokenPrice: STADIUM_ELYSEUM.tokenPrice, updatedAt: new Date() })
        .where(eq(worldLibraryAssets.id, STADIUM_ELYSEUM.id));
      seeded.push(`${STADIUM_ELYSEUM.name} (price updated to ${STADIUM_ELYSEUM.tokenPrice})`);
    }

    // Seed Stadium Elyseum into green-terrain / Troo Town (default world placements)
    const [existingStadiumPlacement] = await db
      .select()
      .from(trooWorldPlacements)
      .where(and(eq(trooWorldPlacements.worldId, "default"), eq(trooWorldPlacements.elementKey, "stadium-elyseum")))
      .limit(1);

    if (!existingStadiumPlacement) {
      await db.insert(trooWorldPlacements).values({
        worldId: "default",
        elementKey: "stadium-elyseum",
        glbUrl: STADIUM_ELYSEUM.modelUrl,
        posX: "0",
        posY: "0",
        posZ: "60",
        scale: "1",
        rotY: "0",
      });
      seeded.push("Stadium Elyseum (green-terrain placement)");
    }

    return NextResponse.json({
      success: true,
      seeded,
      message: seeded.length > 0 ? `Seeded: ${seeded.join(", ")}` : "All assets already exist",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin world-assets seed]", e);
    return NextResponse.json({ error: "Seed failed" }, { status: 500 });
  }
}
