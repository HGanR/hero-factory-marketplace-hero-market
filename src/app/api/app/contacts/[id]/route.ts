import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { crm_contacts, crm_conversations } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { requireUserId } from "@/lib/auth";
import { ensureCrmTables } from "@/lib/db/crm-ensure";

/**
 * GET /api/app/contacts/[id]
 * Contact profile + conversations summary.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid: number;
  try {
    uid = requireUserId(_req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [contact] = await db
      .select()
      .from(crm_contacts)
      .where(and(eq(crm_contacts.id, id), eq(crm_contacts.userId, uid)))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const conversations = await db
      .select({
        id: crm_conversations.id,
        channel: crm_conversations.channel,
        status: crm_conversations.status,
        subject: crm_conversations.subject,
        lastMessageAt: crm_conversations.lastMessageAt,
        lastMessagePreview: crm_conversations.lastMessagePreview,
        unreadCount: crm_conversations.unreadCount,
        createdAt: crm_conversations.createdAt,
        updatedAt: crm_conversations.updatedAt,
      })
      .from(crm_conversations)
      .where(and(eq(crm_conversations.contactId, id), eq(crm_conversations.userId, uid)))
      .orderBy(desc(crm_conversations.lastMessageAt), desc(crm_conversations.updatedAt))
      .limit(50);

    return NextResponse.json({
      contact: {
        id: contact.id,
        workspaceId: contact.workspaceId,
        userId: contact.userId,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        company: contact.company,
        leadSource: contact.leadSource,
        tags: contact.tags,
        customFields: contact.customFields,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      },
      conversations,
    });
  } catch (err) {
    console.error("contacts [id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch contact" }, { status: 500 });
  }
}

/**
 * PATCH /api/app/contacts/[id]
 * Update company, leadSource, tags, customFields.
 */
export async function PATCH(
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.company === "string") patch.company = body.company.trim().slice(0, 255);
  if (typeof body.leadSource === "string") patch.leadSource = body.leadSource.trim().slice(0, 100);
  if (typeof body.tags === "string") patch.tags = body.tags;
  if (body.customFields && typeof body.customFields === "object") patch.customFields = body.customFields;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  try {
    await ensureCrmTables();
    const db = await getDb();

    const [contactExists] = await db
      .select({ id: crm_contacts.id })
      .from(crm_contacts)
      .where(and(eq(crm_contacts.id, id), eq(crm_contacts.userId, uid)))
      .limit(1);
    if (!contactExists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db
      .update(crm_contacts)
      .set(patch)
      .where(and(eq(crm_contacts.id, id), eq(crm_contacts.userId, uid)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("contacts [id] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update contact" }, { status: 500 });
  }
}
