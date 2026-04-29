/**
 * GET /api/troo-world/meeting-nodes — List meeting nodes for a world
 * POST /api/troo-world/meeting-nodes — Create meeting node (admin or auth)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetingNodePlacements, trooWorldPlacements, trooWorlds } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import crypto from "crypto";

const DEFAULT_WORLD_ID = "default";

/** Only these buildings can host meeting nodes */
const ELIGIBLE_BUILDING_KEYS = new Set(["nexus-tower", "meridian-tower", "apex-tower", "harborview-tower", "stadium-elyseum"]);

/** Ensure default world and stadium placement exist (placement may not exist if user never visited Troo Town) */
async function ensureStadiumPlacement(db: Awaited<ReturnType<typeof getDb>>, worldId: string) {
  const [world] = await db.select({ id: trooWorlds.id }).from(trooWorlds).where(eq(trooWorlds.id, worldId)).limit(1);
  if (!world) {
    await db.insert(trooWorlds).values({
      id: worldId,
      name: "Troo World",
      slug: "troo-world",
      isDefault: true,
      isPublished: true,
    });
  }
  const [stadium] = await db
    .select()
    .from(trooWorldPlacements)
    .where(and(eq(trooWorldPlacements.worldId, worldId), eq(trooWorldPlacements.elementKey, "stadium-elyseum")))
    .limit(1);
  if (!stadium) {
    await db.insert(trooWorldPlacements).values({
      worldId,
      elementKey: "stadium-elyseum",
      glbUrl: "/models/world-assets/stadium-elyseum.glb",
      posX: "0",
      posY: "0",
      posZ: "60",
      scale: "1",
      rotY: "0",
    });
  }
}

function requireAdminOrAuth(request: NextRequest): number | null {
  const token =
    request.cookies?.get?.("admin-token")?.value || request.cookies?.get?.("auth-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded) return null;
  if (decoded.userId != null && typeof decoded.userId === "number") return decoded.userId;
  if (decoded.isAdmin) return 0; // system/admin for Troo World
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDb();
    const worldId = request.nextUrl.searchParams.get("worldId") ?? DEFAULT_WORLD_ID;

    const nodes = await db
      .select()
      .from(meetingNodePlacements)
      .where(eq(meetingNodePlacements.worldId, worldId));

    const placements = await db
      .select({ id: trooWorldPlacements.id, elementKey: trooWorldPlacements.elementKey, posX: trooWorldPlacements.posX, posY: trooWorldPlacements.posY, posZ: trooWorldPlacements.posZ })
      .from(trooWorldPlacements)
      .where(eq(trooWorldPlacements.worldId, worldId));

    const placementMap = new Map(placements.map((p) => [p.id, p]));

    return NextResponse.json({
      worldId,
      nodes: nodes.map((n) => {
        const parent = placementMap.get(n.parentPlacementId);
        return {
          id: n.id,
          worldId: n.worldId,
          parentPlacementId: n.parentPlacementId,
          parentElementKey: parent?.elementKey ?? null,
          nodeAssetKey: n.nodeAssetKey,
          roomId: n.roomId,
          title: n.title,
          accessType: n.accessType,
          capacity: n.capacity,
          webEnabled: n.webEnabled,
          webxrEnabled: n.webxrEnabled,
          vrEnabled: n.vrEnabled,
          isActive: n.isActive,
          posX: Number(n.posX),
          posY: Number(n.posY),
          posZ: Number(n.posZ),
          rotY: Number(n.rotY),
          scale: Number(n.scale),
          worldPosX: parent ? Number(parent.posX) + Number(n.posX) : Number(n.posX),
          worldPosY: parent ? Number(parent.posY) + Number(n.posY) : Number(n.posY),
          worldPosZ: parent ? Number(parent.posZ) + Number(n.posZ) : Number(n.posZ),
        };
      }),
    });
  } catch (e) {
    console.error("[troo-world meeting-nodes GET]", e);
    return NextResponse.json({ error: "Failed to load meeting nodes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = requireAdminOrAuth(request);
    if (userId === null) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const body = await request.json();
    const {
      worldId = DEFAULT_WORLD_ID,
      parentPlacementId,
      parentElementKey,
      title,
      accessType = "public",
      capacity = 12,
      webEnabled = true,
      webxrEnabled = false,
      vrEnabled = false,
      posX = 0,
      posY = 0,
      posZ = 0,
      rotY = 0,
      scale = 1,
    } = body as {
      worldId?: string;
      parentPlacementId?: number;
      parentElementKey?: string;
      title: string;
      accessType?: "public" | "private" | "invite_only";
      capacity?: number;
      webEnabled?: boolean;
      webxrEnabled?: boolean;
      vrEnabled?: boolean;
      posX?: number;
      posY?: number;
      posZ?: number;
      rotY?: number;
      scale?: number;
    };

    let resolvedParentId: number;
    let resolvedElementKey: string | null = null;
    if (parentPlacementId != null && typeof parentPlacementId === "number") {
      const [p] = await db
        .select({ id: trooWorldPlacements.id, elementKey: trooWorldPlacements.elementKey })
        .from(trooWorldPlacements)
        .where(eq(trooWorldPlacements.id, parentPlacementId))
        .limit(1);
      if (!p) {
        return NextResponse.json({ error: "Placement not found" }, { status: 404 });
      }
      resolvedParentId = p.id;
      resolvedElementKey = p.elementKey;
    } else if (parentElementKey && typeof parentElementKey === "string") {
      const key = parentElementKey.trim();
      if (key === "stadium-elyseum") {
        await ensureStadiumPlacement(db, worldId);
      }
      const [placement] = await db
        .select({ id: trooWorldPlacements.id, elementKey: trooWorldPlacements.elementKey })
        .from(trooWorldPlacements)
        .where(
          and(
            eq(trooWorldPlacements.worldId, worldId),
            eq(trooWorldPlacements.elementKey, key)
          )
        )
        .limit(1);
      if (!placement) {
        return NextResponse.json(
          { error: `Placement not found for elementKey: ${parentElementKey}` },
          { status: 404 }
        );
      }
      resolvedParentId = placement.id;
      resolvedElementKey = placement.elementKey;
    } else {
      return NextResponse.json(
        { error: "parentPlacementId or parentElementKey is required" },
        { status: 400 }
      );
    }
    if (resolvedElementKey && !ELIGIBLE_BUILDING_KEYS.has(resolvedElementKey)) {
      return NextResponse.json(
        { error: `Only eligible buildings (nexus-tower, meridian-tower, apex-tower, harborview-tower, stadium-elyseum) can host meeting nodes. Got: ${resolvedElementKey}` },
        { status: 400 }
      );
    }
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const roomId = `${worldId}:${id}`;

    await db.insert(meetingNodePlacements).values({
      id,
      worldId,
      parentPlacementId: resolvedParentId,
      parentSystem: "troo_placement",
      nodeAssetKey: "corporate_meeting_node_v1",
      roomId,
      title: title.trim().slice(0, 120),
      accessType: ["public", "private", "invite_only"].includes(accessType) ? accessType : "public",
      capacity: resolvedElementKey === "stadium-elyseum"
        ? Math.max(12, Math.min(500, Number(capacity) || 100))
        : Math.max(2, Math.min(100, Number(capacity) || 12)),
      webEnabled: !!webEnabled,
      webxrEnabled: !!webxrEnabled,
      vrEnabled: !!vrEnabled,
      isActive: true,
      posX: String(Number(posX) || 0),
      posY: String(Number(posY) || 0),
      posZ: String(Number(posZ) || 0),
      rotY: String(Number(rotY) || 0),
      scale: String(Number(scale) || 1),
      createdByUserId: userId,
    });

    return NextResponse.json({
      success: true,
      id,
      roomId,
      message: "Meeting node created",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[troo-world meeting-nodes POST]", e);
    return NextResponse.json(
      { error: "Failed to create meeting node", detail: msg },
      { status: 500 }
    );
  }
}
