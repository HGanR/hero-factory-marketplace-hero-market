import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisElementCategories } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { asc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

async function ensureCategoriesTable(db: Awaited<ReturnType<typeof getDb>>) {
  try {
    await db.execute(sql`SELECT 1 FROM ${oasisElementCategories} LIMIT 1`);
    return;
  } catch (e: any) {
    const msg = String(e?.message || "").toLowerCase();
    const missing =
      msg.includes("oasis_element_categories") &&
      (msg.includes("doesn't exist") ||
        msg.includes("does not exist") ||
        msg.includes("no such table") ||
        msg.includes("er_no_such_table") ||
        msg.includes("failed query"));
    if (!missing) throw e;
  }

  // Create table if missing (minimal schema matching drizzle)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_element_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL UNIQUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )
  `);
}

export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    await ensureCategoriesTable(db);
    const categories = await db.select().from(oasisElementCategories).orderBy(asc(oasisElementCategories.name));
    return NextResponse.json({ categories });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    const missingTable =
      lower.includes("oasis_element_categories") &&
      (lower.includes("doesn't exist") ||
        lower.includes("does not exist") ||
        lower.includes("no such table") ||
        lower.includes("er_no_such_table") ||
        lower.includes("failed query:"));
    if (missingTable) {
      console.error("Admin OASIS categories GET missing table:", msg);
      return NextResponse.json({ categories: [], warning: "Categories table missing. Run DB migrations (oasis_element_categories)." });
    }
    console.error("Admin OASIS categories GET error:", error);
    return NextResponse.json({ error: "Failed to load categories" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const slug = slugify(String(body?.slug ?? name));
    if (!slug) return NextResponse.json({ error: "Invalid slug" }, { status: 400 });

    const db = await getDb();
    await ensureCategoriesTable(db);
    // Prevent duplicates by slug
    const existing = await db
      .select()
      .from(oasisElementCategories)
      .where(eq(oasisElementCategories.slug, slug))
      .limit(1);
    if (existing.length) return NextResponse.json({ error: "Category already exists" }, { status: 409 });

    await db.insert(oasisElementCategories).values({ name, slug });
    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    const missingTable =
      lower.includes("oasis_element_categories") &&
      (lower.includes("doesn't exist") ||
        lower.includes("does not exist") ||
        lower.includes("no such table") ||
        lower.includes("er_no_such_table") ||
        lower.includes("failed query:"));
    if (missingTable) {
      console.error("Admin OASIS category POST missing table:", msg);
      return NextResponse.json(
        { error: "Categories table missing. Run DB migrations (oasis_element_categories)." },
        { status: 500 }
      );
    }
    console.error("Admin OASIS category POST error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}


