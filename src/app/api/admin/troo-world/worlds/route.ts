/**
 * Admin API for managing Troo Worlds.
 * GET: list all worlds
 * POST: create a new world
 * PUT: update a world (rename, toggle published)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooWorlds, trooWorldPlacements, trooWorldElements } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 64);
}

function generateId(): string {
  return `world-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();

    const worlds = await db.select().from(trooWorlds);

    return NextResponse.json({
      worlds: worlds.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        terrainType: w.terrainType,
        isDefault: w.isDefault,
        isPublished: w.isPublished,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin troo-world worlds GET]", e);
    return NextResponse.json({ error: "Failed to load worlds" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const body = await request.json();
    const { name } = body as { name?: string };

    if (!name?.trim()) {
      return NextResponse.json({ error: "World name is required" }, { status: 400 });
    }

    const id = generateId();
    const slug = generateSlug(name.trim());

    await db.insert(trooWorlds).values({
      id,
      name: name.trim(),
      slug,
      isDefault: false,
      isPublished: false,
    });

    const [created] = await db.select().from(trooWorlds).where(eq(trooWorlds.id, id)).limit(1);

    return NextResponse.json({
      success: true,
      world: {
        id: created.id,
        name: created.name,
        slug: created.slug,
        terrainType: created.terrainType,
        isDefault: created.isDefault,
        isPublished: created.isPublished,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin troo-world worlds POST]", e);
    return NextResponse.json({ error: "Failed to create world", detail: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const body = await request.json();
    const { id, name, isPublished } = body as {
      id: string;
      name?: string;
      isPublished?: boolean;
    };

    if (!id) {
      return NextResponse.json({ error: "World ID is required" }, { status: 400 });
    }

    const [existing] = await db.select().from(trooWorlds).where(eq(trooWorlds.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "World not found" }, { status: 404 });
    }

    const updates: Partial<typeof existing> = { updatedAt: new Date() };
    if (name?.trim()) {
      updates.name = name.trim();
      updates.slug = generateSlug(name.trim());
    }
    if (typeof isPublished === "boolean") {
      updates.isPublished = isPublished;
    }

    await db.update(trooWorlds).set(updates).where(eq(trooWorlds.id, id));

    const [updated] = await db.select().from(trooWorlds).where(eq(trooWorlds.id, id)).limit(1);

    return NextResponse.json({
      success: true,
      world: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        terrainType: updated.terrainType,
        isDefault: updated.isDefault,
        isPublished: updated.isPublished,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin troo-world worlds PUT]", e);
    return NextResponse.json({ error: "Failed to update world", detail: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "World ID is required" }, { status: 400 });
    }

    const [existing] = await db.select().from(trooWorlds).where(eq(trooWorlds.id, id)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "World not found" }, { status: 404 });
    }

    if (existing.isDefault) {
      return NextResponse.json({ error: "Cannot delete the default world" }, { status: 400 });
    }

    await db.delete(trooWorldPlacements).where(eq(trooWorldPlacements.worldId, id));
    await db.delete(trooWorldElements).where(eq(trooWorldElements.worldId, id));
    await db.delete(trooWorlds).where(eq(trooWorlds.id, id));

    return NextResponse.json({ success: true, message: "World deleted" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[admin troo-world worlds DELETE]", e);
    return NextResponse.json({ error: "Failed to delete world", detail: msg }, { status: 500 });
  }
}
