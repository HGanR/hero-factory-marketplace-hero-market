import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

async function ensureTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_troo_sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      txHash VARCHAR(120) NOT NULL,
      buyerWallet VARCHAR(140),
      treasuryWallet VARCHAR(140),
      tokenAddress VARCHAR(140),
      amount VARCHAR(64),
      currency VARCHAR(32),
      elementId INT,
      elementName VARCHAR(255),
      assetUri VARCHAR(512),
      placementJson TEXT,
      chainId INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_txhash (txHash),
      INDEX idx_buyer (buyerWallet)
    )
  `);
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    await ensureTable(db);
    const rows = await db.execute(sql`
      SELECT *
      FROM oasis_troo_sales
      ORDER BY createdAt DESC
      LIMIT 200
    `);
    const sales = Array.isArray((rows as any)?.rows) ? (rows as any).rows : (rows as any);
    return NextResponse.json({ sales });
  } catch (err) {
    console.error("admin/oasis/troo-sales GET error:", err);
    return NextResponse.json({ error: "Failed to load sales" }, { status: 500 });
  }
}
