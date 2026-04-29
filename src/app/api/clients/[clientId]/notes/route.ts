import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { clientNotes, clients } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { insertAuditLog } from "@/lib/audit";

const BodySchema = z.object({
  visibility: z.enum(["internal", "client"]).default("internal"),
  note: z.string().min(1),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await ctx.params;
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const owned = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, String(clientId)), eq(clients.userId, userId)))
    .limit(1);
  if (owned.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const noteId = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(clientNotes).values({
      id: noteId,
      clientId: String(clientId),
      createdByUserId: userId,
      visibility: body.visibility,
      note: body.note,
    } as any);

    await insertAuditLog(tx as any, {
      actorUserId: userId,
      action: "client_note_created",
      entityType: "client",
      entityId: String(clientId),
      metadata: { noteId, visibility: body.visibility },
    });
  });

  return NextResponse.json({ noteId, status: "created" });
}



