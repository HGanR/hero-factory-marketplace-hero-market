import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { desc, eq, sql } from "drizzle-orm";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { crm_contacts, crm_conversations } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  let uid: number;
  try {
    uid = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureCrmTables();
    const db = await getDb();

    const rows = await db
      .select({
        id: crm_contacts.id,
        firstName: crm_contacts.firstName,
        lastName: crm_contacts.lastName,
        email: crm_contacts.email,
        phone: crm_contacts.phone,
        leadSource: crm_contacts.leadSource,
        createdAt: crm_contacts.createdAt,
        lastActivityAt: sql<string | null>`MAX(${crm_conversations.lastMessageAt})`.as("lastActivityAt"),
      })
      .from(crm_contacts)
      .leftJoin(crm_conversations, eq(crm_conversations.contactId, crm_contacts.id))
      .where(eq(crm_contacts.userId, uid))
      .groupBy(
        crm_contacts.id,
        crm_contacts.firstName,
        crm_contacts.lastName,
        crm_contacts.email,
        crm_contacts.phone,
        crm_contacts.leadSource,
        crm_contacts.createdAt
      )
      .orderBy(desc(sql`MAX(${crm_conversations.lastMessageAt})`))
      .limit(100);

    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("contacts GET error:", err);
    return NextResponse.json({ error: "Failed to list contacts" }, { status: 500 });
  }
}
