import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dashboard_certificates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(80) NOT NULL,
  asset_address_url TEXT,
  seal_data MEDIUMTEXT,
  watermark_data MEDIUMTEXT,
  qr_data MEDIUMTEXT,
  barcode_data MEDIUMTEXT,
  notice_qr_data MEDIUMTEXT,
  render_data MEDIUMTEXT,
  certificate_json MEDIUMTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureTable(conn: Awaited<ReturnType<typeof getConnection>>) {
  await conn.execute(TABLE_SQL);

  // Auto-migrate: older deployments may have created the table without newer columns
  // (CREATE TABLE IF NOT EXISTS does not update existing tables).
  const alterStatements = [
    "ALTER TABLE dashboard_certificates ADD COLUMN render_data MEDIUMTEXT",
    "ALTER TABLE dashboard_certificates ADD COLUMN certificate_json MEDIUMTEXT",
    "ALTER TABLE dashboard_certificates ADD COLUMN notice_qr_data MEDIUMTEXT",
    "ALTER TABLE dashboard_certificates ADD COLUMN barcode_data MEDIUMTEXT",
    "ALTER TABLE dashboard_certificates ADD COLUMN qr_data MEDIUMTEXT",
    "ALTER TABLE dashboard_certificates ADD COLUMN watermark_data MEDIUMTEXT",
    "ALTER TABLE dashboard_certificates ADD COLUMN seal_data MEDIUMTEXT",
    "ALTER TABLE dashboard_certificates ADD COLUMN asset_address_url TEXT",
  ];

  for (const stmt of alterStatements) {
    try {
      await conn.execute(stmt);
    } catch {
      // Ignore if the column already exists (or ALTER is unsupported by provider)
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
    if (!wallet) {
      console.error("GET /api/certificates: wallet parameter missing");
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }

    console.log(`GET /api/certificates: Fetching certificates for wallet ${wallet}`);

    const conn = await getConnection();
    await ensureTable(conn);

    const [rows] = await conn.execute(
      "SELECT id, wallet_address, asset_address_url, seal_data, watermark_data, qr_data, barcode_data, notice_qr_data, render_data, certificate_json, created_at FROM dashboard_certificates WHERE wallet_address = ? ORDER BY created_at DESC",
      [wallet]
    );

    console.log(`GET /api/certificates: Found ${Array.isArray(rows) ? rows.length : 'unknown'} certificates for wallet ${wallet}`);
    return NextResponse.json({ ok: true, items: rows });
  } catch (err) {
    console.error("GET /api/certificates error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to load certificates: ${errorMessage}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletAddress,
      assetAddressUrl,
      sealDataUrl,
      watermarkDataUrl,
      qrDataUrl,
      barcodeDataUrl,
      noticeQrDataUrl,
      renderDataUrl,
      certificateJson,
    } = body || {};

    if (!walletAddress || typeof walletAddress !== "string") {
      console.error("POST /api/certificates: walletAddress is required");
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }

    if (!sealDataUrl || !watermarkDataUrl || !qrDataUrl || !barcodeDataUrl || !noticeQrDataUrl) {
      console.error("POST /api/certificates: Missing required images for wallet", walletAddress);
      return NextResponse.json({ error: "All images (seal, watermark, qr, barcode, noticeQr) are required" }, { status: 400 });
    }

    console.log(`POST /api/certificates: Saving certificate for wallet ${walletAddress}`);

    const conn = await getConnection();
    await ensureTable(conn);

    const result = await conn.execute(
      "INSERT INTO dashboard_certificates (wallet_address, asset_address_url, seal_data, watermark_data, qr_data, barcode_data, notice_qr_data, render_data, certificate_json) VALUES (?,?,?,?,?,?,?,?,?)",
      [
        walletAddress.toLowerCase(),
        assetAddressUrl ?? "",
        sealDataUrl,
        watermarkDataUrl,
        qrDataUrl,
        barcodeDataUrl,
        noticeQrDataUrl,
        renderDataUrl ?? null,
        typeof certificateJson === "string" ? certificateJson : null,
      ]
    );

    console.log(`POST /api/certificates: Successfully saved certificate for wallet ${walletAddress}`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/certificates error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to save certificate: ${errorMessage}` }, { status: 500 });
  }
}

