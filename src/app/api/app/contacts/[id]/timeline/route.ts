import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { crm_call_logs, crm_contacts, crm_conversations, crm_messages } from "@/lib/db/schema";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

function clampInt(v: string | null, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function parseBefore(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * GET /api/app/contacts/[id]/timeline
 * Merged timeline of messages + call logs.
 * Messages via crm_conversations join (crm_messages has no userId).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: number;
  try {
    uid = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const url = req.nextUrl ?? new URL(req.url);
  const limit = clampInt(url.searchParams.get("limit"), 50, 1, 200);
  const before = parseBefore(url.searchParams.get("before"));

  try {
    await ensureCrmTables();
    const db = await getDb();

    // Contact ownership check
    const [contactCheck] = await db
      .select({ id: crm_contacts.id })
      .from(crm_contacts)
      .where(and(eq(crm_contacts.id, id), eq(crm_contacts.userId, uid)))
      .limit(1);
    if (!contactCheck) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Messages: via conversations join (crm_messages has no userId)
    const msgWhere = [
      eq(crm_conversations.userId, uid),
      eq(crm_conversations.contactId, id),
    ];
    const msgBefore = before ? lt(crm_messages.createdAt, before) : undefined;

    const messages = await db
      .select({
        type: sql<"message">`'message'`.as("type"),
        id: crm_messages.id,
        createdAt: crm_messages.createdAt,
        conversationId: crm_messages.conversationId,
        channel: crm_messages.channel,
        direction: crm_messages.direction,
        status: crm_messages.status,
        subject: crm_messages.subject,
        content: crm_messages.content,
        callLogId: crm_messages.callLogId,
        metadata: crm_messages.metadata,
        threadChannel: crm_conversations.channel,
      })
      .from(crm_conversations)
      .innerJoin(crm_messages, eq(crm_messages.conversationId, crm_conversations.id))
      .where(and(...(msgBefore ? [...msgWhere, msgBefore] : msgWhere)))
      .orderBy(desc(crm_messages.createdAt))
      .limit(limit + 1);

    // Calls: crm_call_logs has userId + contactId
    const callWhere = [eq(crm_call_logs.userId, uid), eq(crm_call_logs.contactId, id)];
    const callBefore = before ? lt(crm_call_logs.createdAt, before) : undefined;

    const calls = await db
      .select({
        type: sql<"call">`'call'`.as("type"),
        id: crm_call_logs.id,
        createdAt: crm_call_logs.createdAt,
        conversationId: crm_call_logs.conversationId,
        fromNumber: crm_call_logs.fromNumber,
        toNumber: crm_call_logs.toNumber,
        direction: crm_call_logs.direction,
        status: crm_call_logs.status,
        duration: crm_call_logs.duration,
        transcript: crm_call_logs.transcript,
        recordingUrl: crm_call_logs.recordingUrl,
        twilioCallSid: crm_call_logs.twilioCallSid,
        voiceAgentId: crm_call_logs.voiceAgentId,
        metadata: crm_call_logs.metadata,
      })
      .from(crm_call_logs)
      .where(and(...(callBefore ? [...callWhere, callBefore] : callWhere)))
      .orderBy(desc(crm_call_logs.createdAt))
      .limit(limit + 1);

    // Dedupe: skip calls that have a message with callLogId (to avoid double-showing)
    const callIdsInMessages = new Set(
      messages.map((m) => m.callLogId).filter(Boolean) as string[]
    );
    const filteredCalls = calls.filter((c) => !callIdsInMessages.has(c.id));

    const merged = [...messages, ...filteredCalls].sort((a: { createdAt: Date | string | null }, b: { createdAt: Date | string | null }) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    const items = merged.slice(0, limit);
    const hasMore = merged.length > limit;
    const nextCursor =
      hasMore && items.length ? items[items.length - 1].createdAt : null;

    return NextResponse.json({
      items: items.map((it) => ({
        ...it,
        createdAt: it.createdAt instanceof Date ? it.createdAt.toISOString() : it.createdAt,
      })),
      nextCursor: nextCursor instanceof Date ? nextCursor.toISOString() : nextCursor,
    });
  } catch (err) {
    console.error("contacts [id] timeline GET error:", err);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
