/**
 * Admin API for a single Troo World element.
 * PUT: update element
 * DELETE: remove element
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trooWorldElements } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

const VALID_TYPES = ["tree", "street_light", "bench", "road_segment", "crosswalk", "bush", "fountain"] as const;

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) throw new Error("Unauthorized");
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) throw new Error("Forbidden");
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const body = await request.json();
    const { posX, posY, posZ, rotY, scale, colorHex, color2Hex, label, type } = body as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if (typeof posX === "number") patch.posX = String(posX);
    if (typeof posY === "number") patch.posY = String(posY);
    if (typeof posZ === "number") patch.posZ = String(posZ);
    if (typeof rotY === "number") patch.rotY = String(rotY);
    if (typeof scale === "number") patch.scale = String(scale);
    if (colorHex !== undefined) patch.colorHex = colorHex;
    if (color2Hex !== undefined) patch.color2Hex = color2Hex;
    if (label !== undefined) patch.label = label;
    if (typeof type === "string" && VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) patch.type = type;

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    await db.update(trooWorldElements).set({ ...patch, updatedAt: new Date() } as any).where(eq(trooWorldElements.id, numId));

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("[admin troo-world elements PUT]", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const db = await getDb();
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    await db.delete(trooWorldElements).where(eq(trooWorldElements.id, numId));
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    if (msg === "Unauthorized" || msg === "Forbidden") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("[admin troo-world elements DELETE]", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
