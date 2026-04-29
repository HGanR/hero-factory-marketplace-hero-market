import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisWorldElements, oasisElementCategories } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { uploadBlobToIPFS } from "@/lib/storage";
import { eq, desc, sql } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";

const CURRENCIES = ["TROO", "TROO_POO", "XRP", "SOL", "POL", "BTC", "ETH", "BNB", "USDC"] as const;
type Currency = (typeof CURRENCIES)[number];

const PRICING_TAG_START = "[[PRICING]]";
const PRICING_TAG_END = "[[/PRICING]]";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function stripPricingTag(description: string | null) {
  if (!description) return null;
  const re = /\[\[PRICING\]\][\s\S]*?\[\[\/PRICING\]\]\s*$/;
  return description.replace(re, "").trim() || null;
}

function withPricingTag(description: string | null, price: string, currency: Currency) {
  const base = stripPricingTag(description) ?? "";
  const payload = JSON.stringify({ price, currency });
  const suffix = `${PRICING_TAG_START}${payload}${PRICING_TAG_END}`;
  return (base ? `${base}\n\n` : "") + suffix;
}

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

function isValidLocalAssetUri(uri: string) {
  // We only allow serving from our own public/ path for "local" assets.
  // This prevents accidentally exposing file:// or server paths.
  return uri.startsWith("/models/") || uri.startsWith("/uploads/") || uri.startsWith("/public/");
}

async function ensureSeed3dw(db: Awaited<ReturnType<typeof getDb>>) {
  // Ensure BUSINESS/buildings category exists
  const catSlug = "buildings";
  let cat = (
    await db
      .select()
      .from(oasisElementCategories)
      .where(eq(oasisElementCategories.slug, catSlug))
      .limit(1)
  )[0];
  if (!cat) {
    const insertRes = await db.insert(oasisElementCategories).values({ name: "BUSINESS", slug: catSlug });
    cat = (
      await db
        .select()
        .from(oasisElementCategories)
        .where(eq(oasisElementCategories.slug, catSlug))
        .limit(1)
    )[0];
  }
  if (!cat) return; // give up silently if still missing

  const assetUri = "/models/3dw/building_model.glb";
  const publicAbs = path.join(process.cwd(), "public");
  const fileAbs = path.join(publicAbs, assetUri.slice(1));

  try {
    const stat = await fs.stat(fileAbs);
    if (!stat.isFile()) return;
  } catch {
    return; // file not present; skip seeding
  }

  const existing = await db
    .select()
    .from(oasisWorldElements)
    .where(eq(oasisWorldElements.assetUri, assetUri))
    .limit(1);
  if (existing.length) return;

  await db.insert(oasisWorldElements).values({
    categoryId: cat.id,
    name: "3DW Building",
    description: "Default 3DW building asset",
    assetUri,
    previewImageUri: null,
    price: "0",
    currency: "TROO",
  });
}

async function ensureTables(db: Awaited<ReturnType<typeof getDb>>) {
  // Ensure categories
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_element_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )
  `);

  // Ensure elements
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_world_elements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      categoryId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255),
      description TEXT,
      assetUri VARCHAR(512) NOT NULL,
      previewImageUri VARCHAR(512),
      creatorWallet VARCHAR(140),
      payoutSplits TEXT,
      acceptedCurrencies TEXT,
      price VARCHAR(64),
      currency VARCHAR(32),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_category (categoryId),
      CONSTRAINT fk_category FOREIGN KEY (categoryId) REFERENCES oasis_element_categories(id) ON DELETE CASCADE
    )
  `);

  // Auto-migrate: ensure newer columns exist even if the table was created by an older schema.
  const alterStatements = [
    "ALTER TABLE oasis_world_elements ADD COLUMN slug VARCHAR(255)",
    "ALTER TABLE oasis_world_elements ADD COLUMN creatorWallet VARCHAR(140)",
    "ALTER TABLE oasis_world_elements ADD COLUMN payoutSplits TEXT",
    "ALTER TABLE oasis_world_elements ADD COLUMN acceptedCurrencies TEXT",
    "ALTER TABLE oasis_world_elements ADD COLUMN price VARCHAR(64)",
    "ALTER TABLE oasis_world_elements ADD COLUMN currency VARCHAR(32)",
  ];
  for (const stmt of alterStatements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch {
      // ignore if column exists
    }
  }
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    await ensureTables(db);
    await ensureSeed3dw(db);
    const elements = await db.select().from(oasisWorldElements).orderBy(desc(oasisWorldElements.createdAt));
    return NextResponse.json({ elements });
  } catch (error) {
    console.error("Admin OASIS elements GET error:", error);
    return NextResponse.json({ error: "Failed to load elements" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const contentType = request.headers.get("content-type") ?? "";

    // JSON mode: create an element from existing local paths (no upload)
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const name = String(body?.name ?? "").trim();
      const slug = slugify(String(body?.slug ?? name));
      const description = String(body?.description ?? "").trim() || null;
      const categoryId = Number(body?.categoryId ?? 0);
      const assetUri = String(body?.assetUri ?? "").trim();
      const previewImageUri = String(body?.previewImageUri ?? "").trim() || null;
      const creatorWallet = String(body?.creatorWallet ?? "").trim() || null;
      const payoutSplitsRaw = Array.isArray(body?.payoutSplits) ? body.payoutSplits : null;
      const acceptedCurrenciesRaw = Array.isArray(body?.acceptedCurrencies) ? body.acceptedCurrencies : null;
      const priceRaw = String(body?.price ?? "0").trim();
      const currencyRaw = String(body?.currency ?? "TROO").trim().toUpperCase();

      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if (!slug) return NextResponse.json({ error: "Valid slug is required" }, { status: 400 });
      if (!Number.isFinite(categoryId) || categoryId <= 0)
        return NextResponse.json({ error: "Valid categoryId is required" }, { status: 400 });
      if (!assetUri) return NextResponse.json({ error: "assetUri is required" }, { status: 400 });
      if (!isValidLocalAssetUri(assetUri)) {
        return NextResponse.json(
          { error: "assetUri must be a local public path like /models/..." },
          { status: 400 }
        );
      }
      if (previewImageUri && !previewImageUri.startsWith("/") && !previewImageUri.startsWith("ipfs://")) {
        return NextResponse.json(
          { error: "previewImageUri must be a public path (/...) or ipfs://..." },
          { status: 400 }
        );
      }

      const priceNum = Number(priceRaw);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return NextResponse.json({ error: "Price must be a number >= 0" }, { status: 400 });
      }
      const price = String(priceNum);
      if (!CURRENCIES.includes(currencyRaw as Currency)) {
        return NextResponse.json(
          { error: `Currency must be one of: ${CURRENCIES.join(", ")}` },
          { status: 400 }
        );
      }
      const currency = currencyRaw as Currency;
      const acceptedCurrencies = acceptedCurrenciesRaw
        ? JSON.stringify(
            acceptedCurrenciesRaw
              .map((c: any) => String(c).trim().toUpperCase())
              .filter((c: string) => CURRENCIES.includes(c as Currency))
          )
        : null;

      const normalizeSplits = (splits: any[] | null) => {
        if (!splits || !Array.isArray(splits) || splits.length === 0) return null;
        const cleaned = splits
          .map((s) => ({
            wallet: String(s?.wallet ?? "").trim(),
            pct: Number(s?.pct),
          }))
          .filter((s) => s.wallet && Number.isFinite(s.pct) && s.pct > 0);
        if (!cleaned.length) return null;
        const sum = cleaned.reduce((acc, s) => acc + s.pct, 0);
        if (sum > 100.000001) throw new Error("payoutSplits total percent must be <= 100");
        return JSON.stringify(cleaned);
      };
      const payoutSplits = normalizeSplits(payoutSplitsRaw);

      const db = await getDb();
      await ensureTables(db);
      await db.insert(oasisWorldElements).values({
        categoryId,
        name,
        slug,
        description: stripPricingTag(description),
        assetUri,
        previewImageUri: previewImageUri || null,
        creatorWallet,
        payoutSplits,
        acceptedCurrencies,
        price,
        currency,
      });

      return NextResponse.json({ success: true, assetUri, previewImageUri, price, currency });
    }

    const form = await request.formData();
    const name = String(form.get("name") ?? "").trim();
    const slug = slugify(String(form.get("slug") ?? name));
    const description = String(form.get("description") ?? "").trim() || null;
    const categoryId = Number(form.get("categoryId") ?? 0);
    const creatorWallet = String(form.get("creatorWallet") ?? "").trim() || null;
    const payoutSplitsStr = String(form.get("payoutSplits") ?? "").trim();
    const acceptedCurrenciesStr = String(form.get("acceptedCurrencies") ?? "").trim();
    const priceRaw = String(form.get("price") ?? "0").trim();
    const currencyRaw = String(form.get("currency") ?? "TROO").trim().toUpperCase();
    const assetFile = form.get("asset") as File | null;
    const previewFile = form.get("preview") as File | null;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!slug) return NextResponse.json({ error: "Valid slug is required" }, { status: 400 });
    if (!Number.isFinite(categoryId) || categoryId <= 0)
      return NextResponse.json({ error: "Valid categoryId is required" }, { status: 400 });
    if (!assetFile) return NextResponse.json({ error: "Asset file is required" }, { status: 400 });

    // Only allow 3D model uploads (.glb/.gltf)
    const assetName = String(assetFile.name || "").toLowerCase();
    if (!assetName.endsWith(".glb") && !assetName.endsWith(".gltf")) {
      return NextResponse.json({ error: "Asset must be a .glb or .gltf file" }, { status: 400 });
    }

    const priceNum = Number(priceRaw);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return NextResponse.json({ error: "Price must be a number >= 0" }, { status: 400 });
    }
    const price = String(priceNum);
    if (!CURRENCIES.includes(currencyRaw as Currency)) {
      return NextResponse.json(
        { error: `Currency must be one of: ${CURRENCIES.join(", ")}` },
        { status: 400 }
      );
    }
    const currency = currencyRaw as Currency;
    const acceptedCurrencies = acceptedCurrenciesStr
      ? JSON.stringify(
          acceptedCurrenciesStr
            .split(",")
            .map((c) => c.trim().toUpperCase())
            .filter((c) => CURRENCIES.includes(c as Currency))
        )
      : null;

    let payoutSplits: string | null = null;
    if (payoutSplitsStr) {
      try {
        const parsed = JSON.parse(payoutSplitsStr);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .map((s) => ({ wallet: String(s?.wallet ?? "").trim(), pct: Number(s?.pct) }))
            .filter((s) => s.wallet && Number.isFinite(s.pct) && s.pct > 0);
          const sum = cleaned.reduce((acc, s) => acc + s.pct, 0);
          if (sum > 100.000001) throw new Error("payoutSplits total percent must be <= 100");
          payoutSplits = cleaned.length ? JSON.stringify(cleaned) : null;
        }
      } catch (e) {
        throw new Error("Invalid payoutSplits JSON");
      }
    }

    // Upload to IPFS
    const assetUri = await uploadBlobToIPFS(assetFile);
    const previewImageUri = previewFile ? await uploadBlobToIPFS(previewFile) : null;

    const db = await getDb();
    await ensureTables(db);
    try {
      // Preferred: store pricing in dedicated columns (requires DB columns to exist)
      await db.insert(oasisWorldElements).values({
        categoryId,
        name,
        slug,
        description: stripPricingTag(description),
        assetUri,
        previewImageUri,
        creatorWallet,
        payoutSplits,
        acceptedCurrencies,
        price,
        currency,
      });
    } catch (e: any) {
      // Backward-compatible fallback: DB may not have price/currency columns yet.
      const msg = String(e?.message || "");
      const isUnknownColumn =
        msg.includes("Unknown column") ||
        msg.includes("ER_BAD_FIELD_ERROR") ||
        msg.toLowerCase().includes("unknown column");
      if (!isUnknownColumn) throw e;

      await db.insert(oasisWorldElements).values({
        categoryId,
        name,
        description: withPricingTag(description, price, currency),
        assetUri,
        previewImageUri,
      });
    }

    return NextResponse.json({ success: true, assetUri, previewImageUri, price, currency });
  } catch (error) {
    console.error("Admin OASIS element POST error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    // Admin-only endpoint: return a useful error message for debugging.
    return NextResponse.json({ error: `Failed to upload element: ${msg}` }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const id = Number(body?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Valid id is required" }, { status: 400 });

    const patch: any = {};
    if (body?.name !== undefined) patch.name = String(body.name).trim();
    if (body?.slug !== undefined) patch.slug = slugify(String(body.slug ?? body.name ?? "").trim());
    if (body?.description !== undefined) patch.description = stripPricingTag(String(body.description ?? "").trim() || null);
    if (body?.categoryId !== undefined) patch.categoryId = Number(body.categoryId);
    if (body?.assetUri !== undefined) {
      const uri = String(body.assetUri).trim();
      if (uri && !uri.startsWith("ipfs://") && !uri.startsWith("/")) {
        return NextResponse.json({ error: "assetUri must be ipfs://... or /..." }, { status: 400 });
      }
      patch.assetUri = uri;
    }
    if (body?.previewImageUri !== undefined) {
      const uri = String(body.previewImageUri ?? "").trim();
      if (uri && !uri.startsWith("ipfs://") && !uri.startsWith("/")) {
        return NextResponse.json({ error: "previewImageUri must be ipfs://... or /..." }, { status: 400 });
      }
      patch.previewImageUri = uri || null;
    }
    if (body?.price !== undefined) patch.price = String(Number(body.price));
    if (body?.currency !== undefined) patch.currency = String(body.currency).toUpperCase();

    // Validate some fields if present
    if (patch.categoryId !== undefined && (!Number.isFinite(patch.categoryId) || patch.categoryId <= 0)) {
      return NextResponse.json({ error: "categoryId must be a number > 0" }, { status: 400 });
    }
    if (patch.slug !== undefined && patch.slug && patch.slug.length < 2) {
      return NextResponse.json({ error: "slug must be at least 2 characters" }, { status: 400 });
    }
    if (patch.price !== undefined) {
      const priceNum = Number(patch.price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return NextResponse.json({ error: "price must be a number >= 0" }, { status: 400 });
      }
      patch.price = String(priceNum);
    }
    if (patch.currency !== undefined && !CURRENCIES.includes(patch.currency as Currency)) {
      return NextResponse.json(
        { error: `currency must be one of: ${CURRENCIES.join(", ")}` },
        { status: 400 }
      );
    }
    if (patch.assetUri !== undefined && patch.assetUri && patch.assetUri.startsWith("/") && !isValidLocalAssetUri(patch.assetUri)) {
      return NextResponse.json({ error: "assetUri must be a safe public path like /models/..." }, { status: 400 });
    }

    const db = await getDb();
    await db.update(oasisWorldElements).set(patch).where(eq(oasisWorldElements.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin OASIS element PATCH error:", error);
    return NextResponse.json({ error: "Failed to update element" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body?.id ?? 0);
    if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: "Valid id is required" }, { status: 400 });

    const db = await getDb();
    await db.delete(oasisWorldElements).where(eq(oasisWorldElements.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin OASIS element DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete element" }, { status: 500 });
  }
}


