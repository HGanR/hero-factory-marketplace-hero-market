import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { computePreview } from "@/lib/conversations/preview";
import { normalizeChannel } from "@/lib/crm/constants";
import { randomUUID } from "crypto";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [convRow] = (await db.execute(sql`
      SELECT c.id, c.contactId, c.channel, c.status, c.subject, c.lastMessageAt, c.createdAt,
        ct.firstName as contactFirstName, ct.lastName as contactLastName, ct.email as contactEmail, ct.phone as contactPhone
      FROM crm_conversations c
      LEFT JOIN crm_contacts ct ON ct.id = c.contactId
      WHERE c.id = ${id} AND c.userId = ${user.userId}
    `)) as any;
    const conv = Array.isArray(convRow) ? convRow[0] : convRow?.rows?.[0] ?? convRow;
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.execute(sql`UPDATE crm_conversations SET unreadCount = 0, updatedAt = NOW() WHERE id = ${id} AND userId = ${user.userId}`);
    await db.execute(sql`UPDATE crm_messages SET status = 'read' WHERE conversationId = ${id} AND direction = 'inbound' AND (status IS NULL OR status != 'read')`);

    const before = req.nextUrl?.searchParams.get("before") || "";
    const msgLimit = Math.min(50, parseInt(req.nextUrl?.searchParams.get("limit") ?? "50", 10) || 50);

    const beforeClause = before ? sql`AND m.createdAt < ${before}` : sql``;
    const msgRows = (await db.execute(sql`
      SELECT m.id, m.direction, m.channel, m.content, m.subject, m.callLogId, m.status as msgStatus, m.createdAt,
        cl.fromNumber, cl.toNumber, cl.duration, cl.recordingUrl, cl.transcript, cl.status as callStatus
      FROM crm_messages m
      LEFT JOIN crm_call_logs cl ON cl.id = m.callLogId
      WHERE m.conversationId = ${id} ${beforeClause}
      ORDER BY m.createdAt DESC
      LIMIT ${msgLimit}
    `)) as any;
    const msgArr = Array.isArray(msgRows) ? msgRows : msgRows?.rows ?? msgRows;
    const rawMessages = Array.isArray(msgArr) ? msgArr : [];
    const messages = rawMessages.map((m: any) => ({
      id: m.id,
      direction: m.direction ?? "inbound",
      channel: m.channel ?? "sms",
      content: m.content ?? null,
      subject: m.subject ?? null,
      status: m.msgStatus ?? "received",
      callLogId: m.callLogId ?? null,
      createdAt: m.createdAt ?? null,
      call: m.callLogId ? {
        fromNumber: m.fromNumber,
        toNumber: m.toNumber,
        duration: m.duration,
        recordingUrl: m.recordingUrl,
        transcript: m.transcript,
        status: m.callStatus,
      } : null,
    }));

    const reversed = messages.reverse();
    const oldest = reversed[0];
    const nextBefore = oldest?.createdAt ?? null;

    return NextResponse.json({
      conversation: {
        id: conv.id,
        contactId: conv.contactId ?? null,
        channel: conv.channel ?? "sms",
        status: conv.status ?? "open",
        subject: conv.subject ?? null,
        lastMessageAt: conv.lastMessageAt ?? null,
        createdAt: conv.createdAt ?? null,
        contact: {
          firstName: conv.contactFirstName ?? "",
          lastName: conv.contactLastName ?? "",
          email: conv.contactEmail ?? "",
          phone: conv.contactPhone ?? "",
        },
      },
      messages: reversed,
      nextBefore,
    });
  } catch (err) {
    console.error("conversations [id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: { content?: string; channel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = body.content ? String(body.content).trim() : "";
  if (!content) return NextResponse.json({ error: "Content is required" }, { status: 400 });
  const channel = normalizeChannel(body.channel ?? "sms");

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [conv] = (await db.execute(sql`
      SELECT id FROM crm_conversations WHERE id = ${id} AND userId = ${user.userId}
    `)) as any;
    const c = Array.isArray(conv) ? conv[0] : conv?.rows?.[0] ?? conv;
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const preview = computePreview({ channel, bodyText: content });
    const msgId = randomUUID();
    await db.execute(sql`
      INSERT INTO crm_messages (id, conversationId, direction, channel, content)
      VALUES (${msgId}, ${id}, 'outbound', ${channel}, ${content})
    `);
    await db.execute(sql`
      UPDATE crm_conversations SET lastMessageAt = NOW(), lastMessagePreview = ${preview}, updatedAt = NOW() WHERE id = ${id}
    `);

    const [inserted] = (await db.execute(sql`
      SELECT id, conversationId, direction, channel, content, createdAt
      FROM crm_messages WHERE id = ${msgId}
    `)) as any;
    const msg = Array.isArray(inserted) ? inserted[0] : inserted?.rows?.[0] ?? inserted;

    return NextResponse.json({
      message: {
        id: msg?.id ?? msgId,
        direction: "outbound",
        channel,
        content,
        createdAt: msg?.createdAt ?? null,
      },
    }, { status: 201 });
  } catch (err) {
    console.error("conversations [id] POST error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
