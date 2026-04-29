/**
 * Developer Webhook - DELETE
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { developerWebhooks } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Missing webhook id" }, { status: 400 });

  const db = await getDb();
  const [row] = await db
    .select()
    .from(developerWebhooks)
    .where(and(eq(developerWebhooks.id, id), eq(developerWebhooks.userId, userId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

  await db.delete(developerWebhooks).where(eq(developerWebhooks.id, id));

  return NextResponse.json({ ok: true });
}
