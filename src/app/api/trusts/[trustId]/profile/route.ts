import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import type { TrustProfile } from "@/lib/ppm/types";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();

  // Verify trust ownership and get profile
  const trustRows = await db
    .select({
      trustKind: trusts.trustType,
      jurisdictionState: trusts.jurisdictionState,
      status: trusts.workspaceStatus,
      updatedAt: trusts.updatedAt,
    })
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);

  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const row = trustRows[0];
  const profile: TrustProfile = {
    trustKind: row.trustKind,
    jurisdictionState: row.jurisdictionState,
    taxClassification: "unknown", // Not in schema
    isCharitable: false, // Not in schema
    isFoundation: false, // Not in schema
    hasEIN: false, // Not in schema
    einLast4: null, // Not in schema
    executedAt: row.status === "executed" ? row.updatedAt?.toISOString() || null : null,
    status: row.status || "draft",
  };

  return NextResponse.json({ profile });
}
