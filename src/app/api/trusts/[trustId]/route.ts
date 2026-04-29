import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();

  // Verify trust ownership and get basic trust info
  const trustRows = await db
    .select({
      id: trusts.id,
      userId: trusts.userId,
      name: trusts.name,
      trustType: trusts.trustType,
      jurisdictionState: trusts.jurisdictionState,
      status: trusts.workspaceStatus,
      clientId: trusts.clientId,
      createdAt: trusts.createdAt,
      updatedAt: trusts.updatedAt,
    })
    .from(trusts)
    .where(eq(trusts.id, trustId))
    .limit(1);

  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const trust = trustRows[0];

  // Verify ownership
  if (trust.userId !== userId) return NextResponse.json({ error: "Access denied" }, { status: 403 });

  return NextResponse.json({
    id: trust.id,
    name: trust.name,
    trustType: trust.trustType,
    jurisdictionState: trust.jurisdictionState,
    status: trust.status,
    clientId: trust.clientId,
    createdAt: trust.createdAt ? new Date(trust.createdAt as any).toISOString() : null,
    updatedAt: trust.updatedAt ? new Date(trust.updatedAt as any).toISOString() : null,
  });
}
