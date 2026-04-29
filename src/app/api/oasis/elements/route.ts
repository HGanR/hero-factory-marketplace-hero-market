// Clean re-write: single public GET, admin POST/PATCH/DELETE
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisWorldElements } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";

function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("admin-token")?.value;
  if (!token) return false;
  const decoded = verifyToken(token);
  return !!decoded?.isAdmin;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categoryIdRaw = searchParams.get("categoryId");
    const db = await getDb();

    // Auto-migrate: make sure the public reader won't crash if DB was created by an older schema.
    // (We keep it best-effort; ignore failures.)
    try {
      await db.execute(sql.raw("ALTER TABLE oasis_world_elements ADD COLUMN slug VARCHAR(255)"));
    } catch {
      // ignore if column exists
    }

    const query = db.select().from(oasisWorldElements).orderBy(desc(oasisWorldElements.createdAt));
    if (categoryIdRaw && Number.isFinite(Number(categoryIdRaw))) {
      query.where(eq(oasisWorldElements.categoryId, Number(categoryIdRaw)));
    }
    const elements = await query;
    return NextResponse.json({ elements });
  } catch (err) {
    console.error("oasis/elements GET error:", err);
    return NextResponse.json({ error: "Failed to load elements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const description = String(body?.description ?? "").trim() || null;
    const categoryId = Number(body?.categoryId ?? 0);
    const assetUri = String(body?.assetUri ?? "").trim();
    const previewImageUri = String(body?.previewImageUri ?? "").trim() || null;
    const price = String(body?.price ?? "0");
    const currencyRaw = String(body?.currency ?? "TROO").toUpperCase();
    const allowedCurrencies = ["TROO", "TROO_POO", "XRP", "SOL", "POL"] as const;
    const currency = allowedCurrencies.includes(currencyRaw as any) ? (currencyRaw as (typeof allowedCurrencies)[number]) : "TROO";

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!Number.isFinite(categoryId) || categoryId <= 0)
      return NextResponse.json({ error: "Valid categoryId is required" }, { status: 400 });
    if (!assetUri) return NextResponse.json({ error: "assetUri is required" }, { status: 400 });
    if (!assetUri.startsWith("/")) return NextResponse.json({ error: "assetUri must start with /" }, { status: 400 });

    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) return NextResponse.json({ error: "Price must be >= 0" }, { status: 400 });

    const db = await getDb();
    await db.insert(oasisWorldElements).values({
      categoryId,
      name,
      description,
      assetUri,
      previewImageUri: previewImageUri || null,
      price: String(priceNum),
      currency,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("oasis/elements POST error:", err);
    return NextResponse.json({ error: "Failed to upload element" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const id = Number(body?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Valid id is required" }, { status: 400 });

    const patch: any = {};
    if (body?.name !== undefined) patch.name = String(body.name).trim();
    if (body?.description !== undefined) patch.description = String(body.description ?? "").trim() || null;
    if (body?.categoryId !== undefined) patch.categoryId = Number(body.categoryId);
    if (body?.assetUri !== undefined) patch.assetUri = String(body.assetUri).trim();
    if (body?.previewImageUri !== undefined) patch.previewImageUri = String(body.previewImageUri ?? "").trim() || null;
    if (body?.price !== undefined) patch.price = String(body.price);
    if (body?.currency !== undefined) {
      const cRaw = String(body.currency).toUpperCase();
      const allowed = ["TROO", "TROO_POO", "XRP", "SOL", "POL"] as const;
      patch.currency = allowed.includes(cRaw as any) ? cRaw : "TROO";
    }

    const db = await getDb();
    await db.update(oasisWorldElements).set(patch).where(eq(oasisWorldElements.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("oasis/elements PATCH error:", err);
    return NextResponse.json({ error: "Failed to update element" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const id = Number(body?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Valid id is required" }, { status: 400 });

    const db = await getDb();
    await db.delete(oasisWorldElements).where(eq(oasisWorldElements.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("oasis/elements DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete element" }, { status: 500 });
  }
}
