import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { computePreview } from "@/lib/conversations/preview";
import { normalizeChannel, normalizeDirection } from "@/lib/crm/constants";
import { randomUUID } from "crypto";

function getCurrentUser(req: NextRequest): { userId: number } | null {
  const token = req.cookies.get("auth-token")?.value || req.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ? { userId: decoded.userId as number } : null;
}

/**
 * POST /api/app/conversations/[id]/messages
 * Add a message/note to a conversation. REST-style endpoint.
 * Accepts: { text } or { content }, optional { channel, direction, provider }.
 * channel: "note"|"email"|"sms", direction: "outbound"|"system", provider: "manual"|"ses"
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  let body: { text?: string; content?: string; channel?: string; direction?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const content = (body.text ?? body.content ?? "").trim();
  if (!content) return NextResponse.json({ error: "text or content is required" }, { status: 400 });
  const channel = normalizeChannel(body.channel ?? "note");
  const direction = normalizeDirection(body.direction ?? "outbound");
  const provider = ["manual", "ses"].includes(body.provider ?? "") ? body.provider! : "manual";

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [conv] = (await db.execute(sql`
      SELECT id, contactId FROM crm_conversations WHERE id = ${id} AND userId = ${user.userId}
    `)) as any;
    const c = Array.isArray(conv) ? conv[0] : conv?.rows?.[0] ?? conv;
    if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const preview = computePreview({ channel, bodyText: content });
    const msgId = randomUUID();
    await db.execute(sql`
      INSERT INTO crm_messages (id, conversationId, direction, channel, content)
      VALUES (${msgId}, ${id}, ${direction}, ${channel}, ${content})
    `);
    await db.execute(sql`
      UPDATE crm_conversations SET lastMessageAt = NOW(), lastMessagePreview = ${preview}, updatedAt = NOW() WHERE id = ${id}
    `);

    const [inserted] = (await db.execute(sql`
      SELECT id, conversationId, direction, channel, content, createdAt
      FROM crm_messages WHERE id = ${msgId}
    `)) as any;
    const msg = Array.isArray(inserted) ? inserted[0] : inserted?.rows?.[0] ?? inserted;

    return NextResponse.json(
      {
        ok: true,
        id: msg?.id ?? msgId,
        message: {
          id: msg?.id ?? msgId,
          direction: "outbound",
          channel,
          content,
          createdAt: msg?.createdAt ?? null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("conversations [id] messages POST error:", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
