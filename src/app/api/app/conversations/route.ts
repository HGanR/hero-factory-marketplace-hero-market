import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

export async function GET(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel") || "";
  const contactId = searchParams.get("contactId") || "";
  const status = searchParams.get("status") || "";
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "50", 10) || 50);
  const cursorLastAt = searchParams.get("cursorLastAt") || "";
  const cursorId = searchParams.get("cursorId") || "";

  try {
    await ensureCrmTables();
    const db = await getDb();
    const uid = user.userId;

    const conditions = [sql`c.userId = ${uid}`];
    if (channel) conditions.push(sql`c.channel = ${channel}`);
    if (contactId) conditions.push(sql`c.contactId = ${contactId}`);
    if (status) conditions.push(sql`c.status = ${status}`);
    if (cursorLastAt && cursorId) {
      conditions.push(sql`(c.lastMessageAt < ${cursorLastAt} OR (c.lastMessageAt = ${cursorLastAt} AND c.id < ${cursorId}))`);
    }
    const where = sql.join(conditions, sql` AND `);

    const rows = (await db.execute(sql`
      SELECT c.id, c.contactId, c.channel, c.status, c.subject, c.lastMessageAt, c.lastMessagePreview, c.unreadCount, c.createdAt,
        COALESCE(ct.firstName, '') as contactFirstName,
        COALESCE(ct.lastName, '') as contactLastName,
        COALESCE(ct.email, '') as contactEmail,
        COALESCE(ct.phone, '') as contactPhone,
        (SELECT COUNT(*) FROM crm_messages m WHERE m.conversationId = c.id) as messageCount
      FROM crm_conversations c
      LEFT JOIN crm_contacts ct ON ct.id = c.contactId
      WHERE ${where}
      ORDER BY c.lastMessageAt DESC, c.id DESC
      LIMIT ${limit + 1}
    `)) as any;

    const arr = Array.isArray(rows) ? rows : rows?.rows ?? rows;
    const items = Array.isArray(arr) ? arr : [];
    const hasMore = items.length > limit;
    const conversations = (hasMore ? items.slice(0, limit) : items).map((r: any) => ({
      id: r.id,
      contactId: r.contactId ?? null,
      channel: r.channel ?? "sms",
      status: r.status ?? "open",
      subject: r.subject ?? null,
      lastMessageAt: r.lastMessageAt ?? null,
      lastMessagePreview: r.lastMessagePreview ?? null,
      unreadCount: Number(r.unreadCount ?? 0),
      createdAt: r.createdAt ?? null,
      contact: {
        firstName: r.contactFirstName ?? "",
        lastName: r.contactLastName ?? "",
        email: r.contactEmail ?? "",
        phone: r.contactPhone ?? "",
      },
      messageCount: Number(r.messageCount ?? 0),
    }));

    const last = conversations[conversations.length - 1];
    const nextCursor = hasMore && last
      ? `cursorLastAt=${encodeURIComponent(last.lastMessageAt ?? "")}&cursorId=${encodeURIComponent(last.id)}`
      : null;

    return NextResponse.json({ conversations, nextCursor });
  } catch (err) {
    console.error("conversations GET error:", err);
    return NextResponse.json({ error: "Failed to list conversations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { contactId?: string; channel?: string; subject?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const contactId = body.contactId ? String(body.contactId).trim() : null;
  const channel = (body.channel || "sms").trim();
  const subject = body.subject ? String(body.subject).trim() : null;

  if (!contactId) return NextResponse.json({ error: "contactId is required" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();
    const { randomUUID } = await import("crypto");
    const id = randomUUID();

    await db.execute(sql`
      INSERT INTO crm_conversations (id, contactId, userId, channel, status, subject)
      VALUES (${id}, ${contactId}, ${user.userId}, ${channel}, 'open', ${subject})
    `);

    return NextResponse.json({
      conversation: {
        id,
        contactId,
        channel,
        status: "open",
        subject,
        createdAt: new Date().toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    console.error("conversations POST error:", err);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
