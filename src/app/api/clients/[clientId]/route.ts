import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { clients, clientNotes } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await ctx.params;
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, String(clientId)), eq(clients.userId, userId)))
    .limit(1);

  if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const c: any = rows[0];

  const notes = await db
    .select()
    .from(clientNotes)
    .where(eq(clientNotes.clientId, String(clientId)))
    .orderBy(desc(clientNotes.createdAt));

  return NextResponse.json({
    client: {
      id: String(c.id),
      firstName: c.firstName,
      middleName: c.middleName ?? null,
      lastName: c.lastName,
      suffix: c.suffix ?? null,
      email: c.email,
      phone: c.phone ?? null,
      address: {
        line1: c.addressLine1,
        line2: c.addressLine2 ?? null,
        city: c.city,
        state: c.state,
        postalCode: c.postalCode,
        country: c.country,
      },
      createdAt: c.createdAt ? new Date(c.createdAt as any).toISOString() : null,
      updatedAt: c.updatedAt ? new Date(c.updatedAt as any).toISOString() : null,
    },
    notes: notes.map((n: any) => ({
      id: String(n.id),
      clientId: String(n.clientId),
      createdByUserId: n.createdByUserId,
      visibility: n.visibility,
      note: n.note,
      createdAt: n.createdAt ? new Date(n.createdAt as any).toISOString() : null,
    })),
  });
}



