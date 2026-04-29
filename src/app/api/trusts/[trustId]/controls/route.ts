import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { trustControls, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  const c: any = controlRows[0] ?? null;

  return NextResponse.json(
    {
      trustId,
      securitiesEnabled: Boolean(c?.securitiesEnabled ?? false),
      requireCounselApproval: Boolean(c?.requireCounselApproval ?? true),
      requireTrusteeApproval: Boolean(c?.requireTrusteeApproval ?? true),
      // Placeholder until we add this column (requested shape)
      defaultCustodyMode: "holder_possession",
    },
    {
      // Private, cookie-scoped caching for session navigation. Keep TTL low because controls can change mid-session.
      headers: {
        "Cache-Control": "private, max-age=60",
        Vary: "Cookie",
      },
    }
  );
}


