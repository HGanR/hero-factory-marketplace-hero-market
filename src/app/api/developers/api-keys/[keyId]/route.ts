/**
 * Developer API Key - DELETE
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { developerApiKeys } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ keyId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyId } = await ctx.params;
  if (!keyId) return NextResponse.json({ error: "keyId required" }, { status: 400 });

  const db = await getDb();
  await db
    .delete(developerApiKeys)
    .where(and(eq(developerApiKeys.id, keyId), eq(developerApiKeys.userId, userId)));

  return NextResponse.json({ ok: true, deleted: keyId });
}
