import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { oasisAssetPacks, oasisMarketListings } from "@/lib/db/schema";
import { ensureOasisMarketTables, normalizeSlug } from "@/lib/oasis/market-db";

const CURRENCIES = ["TROO", "TROO_POO", "XRP", "SOL", "POL", "BTC", "ETH", "BNB", "USDC"] as const;
const ENGINES = ["unity", "unreal", "universal"] as const;

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    await ensureOasisMarketTables(db);
    const packs = await db.select().from(oasisAssetPacks).orderBy(desc(oasisAssetPacks.updatedAt));
    return NextResponse.json({ packs });
  } catch (error) {
    console.error("admin/oasis/packs GET failed", error);
    return NextResponse.json({ error: "Failed to list packs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const slug = normalizeSlug(String(body?.slug ?? name));
    const summary = String(body?.summary ?? "").trim() || null;
    const description = String(body?.description ?? "").trim() || null;
    const previewImageUri = String(body?.previewImageUri ?? "").trim() || null;
    const packManifestUri = String(body?.packManifestUri ?? "").trim() || null;
    const includedElementIds = Array.isArray(body?.includedElementIds)
      ? body.includedElementIds.map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    const tags = Array.isArray(body?.tags)
      ? body.tags.map((v: unknown) => String(v).trim()).filter(Boolean)
      : [];
    const isPublished = Boolean(body?.isPublished ?? false);
    const engineRaw = String(body?.engine ?? "universal").toLowerCase();
    const engine = ENGINES.includes(engineRaw as (typeof ENGINES)[number])
      ? (engineRaw as (typeof ENGINES)[number])
      : "universal";
    const priceRaw = Number(body?.price ?? 0);
    const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? String(priceRaw) : "0";
    const currencyRaw = String(body?.currency ?? "TROO").toUpperCase();
    const currency = CURRENCIES.includes(currencyRaw as (typeof CURRENCIES)[number])
      ? (currencyRaw as (typeof CURRENCIES)[number])
      : "TROO";

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "slug is required" }, { status: 400 });

    const db = await getDb();
    await ensureOasisMarketTables(db);
    const id = crypto.randomUUID();
    const adminUserId = Number((admin as any).userId ?? (admin as any).id ?? 0);

    await db.insert(oasisAssetPacks).values({
      id,
      name,
      slug,
      summary,
      description,
      engine,
      previewImageUri,
      packManifestUri,
      includedElementIds: includedElementIds.length ? JSON.stringify(includedElementIds) : null,
      tags: tags.length ? JSON.stringify(tags) : null,
      isPublished,
      createdByUserId: adminUserId,
    });

    await db.insert(oasisMarketListings).values({
      id: crypto.randomUUID(),
      itemType: "pack",
      itemRefId: id,
      title: name,
      subtitle: summary,
      description,
      previewImageUri,
      engine,
      price,
      currency,
      isPublished,
      createdByUserId: adminUserId,
    });

    return NextResponse.json({ ok: true, packId: id }, { status: 201 });
  } catch (error) {
    console.error("admin/oasis/packs POST failed", error);
    return NextResponse.json({ error: "Failed to create pack" }, { status: 500 });
  }
}
