import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS dashboard_meetings (
  id VARCHAR(36) PRIMARY KEY,
  wallet_address VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  meeting_date DATE NOT NULL,
  attendees TEXT,
  location VARCHAR(255),
  agenda TEXT,
  notes TEXT,
  resolutions TEXT,
  seal_data MEDIUMTEXT,
  watermark_data MEDIUMTEXT,
  qr_data MEDIUMTEXT,
  barcode_data MEDIUMTEXT,
  notice_qr_data MEDIUMTEXT,
  render_data MEDIUMTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureTable(conn: Awaited<ReturnType<typeof getConnection>>) {
  await conn.execute(TABLE_SQL);

  // Auto-migrate: ensure columns exist even if table was created by an older schema.
  const alterStatements = [
    "ALTER TABLE dashboard_meetings ADD COLUMN render_data MEDIUMTEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN notice_qr_data MEDIUMTEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN barcode_data MEDIUMTEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN qr_data MEDIUMTEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN watermark_data MEDIUMTEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN seal_data MEDIUMTEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN resolutions TEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN notes TEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN agenda TEXT",
    "ALTER TABLE dashboard_meetings ADD COLUMN location VARCHAR(255)",
    "ALTER TABLE dashboard_meetings ADD COLUMN attendees TEXT",
  ];

  for (const stmt of alterStatements) {
    try {
      await conn.execute(stmt);
    } catch {
      // Ignore if the column already exists
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet")?.toLowerCase();
    if (!wallet) {
      console.error("GET /api/meetings: wallet parameter missing");
      return NextResponse.json({ error: "wallet required" }, { status: 400 });
    }

    console.log(`GET /api/meetings: Fetching meetings for wallet ${wallet}`);

    const conn = await getConnection();
    await ensureTable(conn);

    const [rows] = await conn.execute(
      "SELECT id, wallet_address, title, meeting_date, attendees, location, agenda, notes, resolutions, seal_data, watermark_data, qr_data, barcode_data, notice_qr_data, render_data, created_at FROM dashboard_meetings WHERE wallet_address = ? ORDER BY created_at DESC",
      [wallet]
    );

    console.log(`GET /api/meetings: Found ${Array.isArray(rows) ? rows.length : 'unknown'} meetings for wallet ${wallet}`);
    return NextResponse.json({ ok: true, items: rows });
  } catch (err) {
    console.error("GET /api/meetings error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to load meetings: ${errorMessage}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      walletAddress,
      title,
      meetingDate,
      attendees,
      location,
      agenda,
      notes,
      resolutions,
      sealDataUrl,
      watermarkDataUrl,
      qrDataUrl,
      barcodeDataUrl,
      noticeQrDataUrl,
      renderDataUrl,
    } = body || {};

    if (!walletAddress || typeof walletAddress !== "string") {
      console.error("POST /api/meetings: walletAddress is required");
      return NextResponse.json({ error: "walletAddress is required" }, { status: 400 });
    }
    if (!title || typeof title !== "string") {
      console.error("POST /api/meetings: title is required");
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!meetingDate) {
      console.error("POST /api/meetings: meetingDate is required");
      return NextResponse.json({ error: "meetingDate is required" }, { status: 400 });
    }

    console.log(`POST /api/meetings: Saving meeting "${title}" for wallet ${walletAddress}`);

    const conn = await getConnection();
    await ensureTable(conn);

    // Generate UUID for meeting ID
    const meetingId = crypto.randomUUID();

    const result = await conn.execute(
      "INSERT INTO dashboard_meetings (id, wallet_address, title, meeting_date, attendees, location, agenda, notes, resolutions, seal_data, watermark_data, qr_data, barcode_data, notice_qr_data, render_data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        meetingId,
        walletAddress.toLowerCase(),
        title,
        meetingDate,
        attendees ?? null,
        location ?? null,
        agenda ?? null,
        notes ?? null,
        resolutions ?? null,
        sealDataUrl ?? null,
        watermarkDataUrl ?? null,
        qrDataUrl ?? null,
        barcodeDataUrl ?? null,
        noticeQrDataUrl ?? null,
        renderDataUrl ?? null,
      ]
    );

    console.log(`POST /api/meetings: Successfully saved meeting "${title}" for wallet ${walletAddress}`);

    return NextResponse.json({ ok: true, meetingId });
  } catch (err) {
    console.error("POST /api/meetings error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to save meeting: ${errorMessage}` }, { status: 500 });
  }
}
