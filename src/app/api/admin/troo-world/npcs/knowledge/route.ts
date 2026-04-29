/**
 * Admin API for NPC Knowledge Documents.
 * GET:    List knowledge documents for an NPC
 * POST:   Create a new knowledge document
 * PUT:    Update a knowledge document
 * DELETE: Remove a knowledge document
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisNpcKnowledge } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const npcId = searchParams.get("npcId");

    if (!npcId) {
      return NextResponse.json({ error: "npcId is required" }, { status: 400 });
    }

    const docs = await db
      .select()
      .from(oasisNpcKnowledge)
      .where(eq(oasisNpcKnowledge.npcId, parseInt(npcId, 10)))
      .orderBy(oasisNpcKnowledge.priority);

    return NextResponse.json({ documents: docs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("GET /api/admin/troo-world/npcs/knowledge error:", error);
    return NextResponse.json({ error: "Failed to fetch knowledge" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const body = await request.json();

    const { npcId, topic, keywords, content, priority = 5, category = "general" } = body;

    if (!npcId || !topic || !content) {
      return NextResponse.json(
        { error: "npcId, topic, and content are required" },
        { status: 400 }
      );
    }

    const result = await db.insert(oasisNpcKnowledge).values({
      npcId,
      topic,
      keywords: keywords || "",
      content,
      priority,
      category,
    });

    return NextResponse.json({ success: true, id: result[0].insertId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("POST /api/admin/troo-world/npcs/knowledge error:", error);
    return NextResponse.json({ error: "Failed to create knowledge" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const body = await request.json();

    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (updates.topic !== undefined) updateData.topic = updates.topic;
    if (updates.keywords !== undefined) updateData.keywords = updates.keywords;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.category !== undefined) updateData.category = updates.category;

    await db.update(oasisNpcKnowledge).set(updateData).where(eq(oasisNpcKnowledge.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("PUT /api/admin/troo-world/npcs/knowledge error:", error);
    return NextResponse.json({ error: "Failed to update knowledge" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    await db.delete(oasisNpcKnowledge).where(eq(oasisNpcKnowledge.id, parseInt(id, 10)));

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("DELETE /api/admin/troo-world/npcs/knowledge error:", error);
    return NextResponse.json({ error: "Failed to delete knowledge" }, { status: 500 });
  }
}
