import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { allocateTrustId } from "@/lib/sequences";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();

  // Verify trust ownership and get current state
  const trustRows = await db
    .select({
      id: trusts.id,
      // publicId: trusts.publicId, // TODO: Add to trusts table schema
      jurisdictionState: trusts.jurisdictionState,
      name: trusts.name,
    })
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);

  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const trust = trustRows[0];

  // TODO: Check if public ID already exists when field is added
  // if (trust.publicId) {
  //   return NextResponse.json({
  //     error: "Public ID already assigned",
  //     trust: {
  //       id: trust.id,
  //       publicId: trust.publicId,
  //     }
  //   }, { status: 409 });
  // }

  // Generate TID
  const state = trust.jurisdictionState || "XX"; // Default to XX if no state
  const year = new Date().getFullYear();
  const publicId = await allocateTrustId(state, year);

  // TODO: Update trust with public ID when field is added
  // await db
  //   .update(trusts)
  //   .set({ publicId })
  //   .where(eq(trusts.id, trustId));

  return NextResponse.json({
    trust: {
      id: trust.id,
      publicId,
      jurisdictionState: state,
      name: trust.name,
    },
    note: "Public ID generated but not yet stored in database. Add publicId field to trusts table."
  });
}
