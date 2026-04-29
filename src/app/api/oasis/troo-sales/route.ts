import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sql } from "drizzle-orm";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const txHash = String(body?.txHash ?? "").trim();
    if (!txHash) return NextResponse.json({ error: "txHash is required" }, { status: 400 });

    const db = await getDb();
    await ensureTable(db);

    await db.execute(sql`
      INSERT INTO oasis_troo_sales
        (txHash, buyerWallet, treasuryWallet, tokenAddress, amount, currency, elementId, elementName, assetUri, placementJson, chainId)
      VALUES
        (
          ${txHash},
          ${body?.buyerWallet ?? null},
          ${body?.treasuryWallet ?? null},
          ${body?.tokenAddress ?? null},
          ${String(body?.amount ?? "")},
          ${String(body?.currency ?? "")},
          ${body?.elementId ?? null},
          ${body?.elementName ?? null},
          ${body?.assetUri ?? null},
          ${body?.placement ? JSON.stringify(body.placement) : null},
          ${body?.chainId ?? null}
        )
    `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("oasis/troo-sales POST error:", err);
    return NextResponse.json({ error: "Failed to record sale" }, { status: 500 });
  }
}
