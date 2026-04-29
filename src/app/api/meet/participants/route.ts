import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

const TABLE_SQL = `
CREATE TABLE IF NOT EXISTS meet_participants (
  id VARCHAR(36) PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  participant_identity VARCHAR(255) NOT NULL,
  participant_name VARCHAR(255) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  wallet_address VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_room_identity (room_id, participant_identity),
  INDEX idx_room (room_id),
  INDEX idx_room_joined (room_id, joined_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureTable(conn: Awaited<ReturnType<typeof getConnection>>) {
  await conn.execute(TABLE_SQL);
}

/**
 * POST /api/meet/participants - Record or update participants for Meeting Minutes
 * Body: { roomId, participants: [{ identity, name, joinedAt?, leftAt?, walletAddress? }] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const roomId = (body?.roomId || body?.room_id || "").trim();
    const participants = Array.isArray(body?.participants) ? body.participants : [];

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const conn = await getConnection();
    await ensureTable(conn);

    for (const p of participants) {
      const identity = (p.identity || p.participant_identity || "").trim();
      const name = (p.name || p.participant_name || "Participant").trim().slice(0, 255);
      const walletAddress = (p.walletAddress || p.wallet_address || null) as string | null;
      const joinedAt = p.joinedAt || p.joined_at || new Date().toISOString();
      const leftAt = p.leftAt ?? p.left_at ?? null;

      if (!identity) continue;

      const id = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO meet_participants (id, room_id, participant_identity, participant_name, joined_at, left_at, wallet_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           participant_name = VALUES(participant_name),
           left_at = COALESCE(VALUES(left_at), left_at)`,
        [id, roomId, identity, name, joinedAt, leftAt, walletAddress]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Meet participants error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/meet/participants?roomId=X - Get participant record for Meeting Minutes
 */
export async function GET(req: NextRequest) {
  try {
    const roomId = req.nextUrl.searchParams.get("roomId")?.trim();
    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    const conn = await getConnection();
    await ensureTable(conn);

    const [rows] = await conn.execute(
      `SELECT participant_identity, participant_name, joined_at, left_at, wallet_address
       FROM meet_participants
       WHERE room_id = ?
       ORDER BY joined_at ASC`,
      [roomId]
    );

    return NextResponse.json({
      ok: true,
      roomId,
      participants: Array.isArray(rows) ? rows : [],
    });
  } catch (err) {
    console.error("Meet participants GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
