/**
 * GET /api/worlds — List public worlds (explorer) or my worlds (if authenticated)
 * POST /api/worlds — Create a world (requires auth)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { worlds, worldVersions } from "@/lib/db/schema.worlds";
import { getAuthedUserId } from "@/lib/api/auth";
import crypto from "crypto";

function generateId(): string {
  return crypto.randomUUID();
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    const { searchParams } = request.nextUrl;
    const scope = searchParams.get("scope") ?? "public"; // "public" | "me"

    const db = await getDb();

    if (scope === "me") {
      if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const myWorlds = await db
        .select()
        .from(worlds)
        .where(eq(worlds.ownerId, userId))
        .orderBy(desc(worlds.updatedAt));

      return NextResponse.json({
        worlds: myWorlds.map((w) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          visibility: w.visibility,
          terrainSeed: w.terrainSeed,
          biomeType: w.biomeType,
          status: w.status,
          createdAt: w.createdAt?.toISOString(),
          updatedAt: w.updatedAt?.toISOString(),
        })),
      });
    }

    // Public: list worlds with visibility public or unlisted
    const publicWorlds = await db
      .select()
      .from(worlds)
      .where(
        and(
          eq(worlds.status, "published"),
          or(eq(worlds.visibility, "public"), eq(worlds.visibility, "unlisted"))
        )
      )
      .orderBy(desc(worlds.updatedAt))
      .limit(50);

    return NextResponse.json({
      worlds: publicWorlds.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        visibility: w.visibility,
        terrainSeed: w.terrainSeed,
        biomeType: w.biomeType,
        status: w.status,
        createdAt: w.createdAt?.toISOString(),
        updatedAt: w.updatedAt?.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[api/worlds GET]", e);
    return NextResponse.json({ error: "Failed to load worlds" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Sign in to create a world. Use the Dashboard or Admin panel to sign in." },
        { status: 401 }
      );
    }

    let body: { name?: string; description?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { name, description } = body;
    if (!name?.trim()) {
      return NextResponse.json({ error: "World name is required" }, { status: 400 });
    }

    const db = await getDb();
    const worldId = generateId();
    const draftVersionId = generateId();

    const terrainSeed = Math.floor(Math.random() * 1_000_000);
    const descVal = description?.trim() || null;
    await db.execute(
      sql`INSERT INTO worlds (id, ownerId, name, description, visibility, terrainSeed, biomeType, status)
          VALUES (${worldId}, ${userId}, ${name.trim()}, ${descVal}, ${"private"}, ${terrainSeed}, ${"green-terrain"}, ${"draft"})`
    );

    await db.insert(worldVersions).values({
      id: draftVersionId,
      worldId,
      versionType: "draft",
      versionNumber: 1,
    });

    const [rows] = (await db.execute(
      sql`SELECT id, name, description, visibility, terrainSeed, biomeType, status, createdAt, updatedAt FROM worlds WHERE id = ${worldId} LIMIT 1`
    )) as any;
    const created = Array.isArray(rows) ? rows[0] : rows?.rows?.[0] ?? rows;
    if (!created) {
      throw new Error("World created but could not be retrieved");
    }

    return NextResponse.json(
      {
        world: {
          id: created.id,
          name: created.name,
          description: created.description,
          visibility: created.visibility,
          terrainSeed: created.terrainSeed,
          biomeType: created.biomeType,
          status: created.status,
          createdAt: created.createdAt?.toISOString?.() ?? null,
          updatedAt: created.updatedAt?.toISOString?.() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    const err = e as Error & { code?: string; errno?: number };
    console.error("[api/worlds POST]", e);
    const message = String(err?.message ?? "Unknown error");
    let hint = "Failed to create world";
    if (
      message.includes("doesn't exist") ||
      message.includes("DATABASE_URL") ||
      message.includes("ECONNREFUSED") ||
      message.includes("Access denied") ||
      message.includes("Unknown database")
    ) {
      hint =
        "Database issue: ensure DATABASE_URL is set. Run: node scripts/run-migration.mjs drizzle/0014_worlds_tables_only.sql";
    } else if (process.env.NODE_ENV === "development") {
      hint = message;
    }
    return NextResponse.json(
      { error: hint, detail: message },
      { status: 500 }
    );
  }
}
