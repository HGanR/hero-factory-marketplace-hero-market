import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { securityHolders, trustControls, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateSchema = z.object({
  displayName: z.string().min(1).max(255),
  holderRef: z.string().max(191).optional(),
});

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  if (!controlRows[0]?.securitiesEnabled) {
    return NextResponse.json({ error: "Securities Module not enabled for this trust" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(securityHolders)
    .where(eq(securityHolders.trustId, trustId))
    .orderBy(sql`createdAt desc`)
    .limit(200);

  return NextResponse.json({
    trustId,
    items: rows.map((r: any) => ({
      id: String(r.id),
      displayName: String(r.displayName),
      holderRef: r.holderRef ? String(r.holderRef) : null,
      createdAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
    })),
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await request.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  if (!controlRows[0]?.securitiesEnabled) {
    return NextResponse.json({ error: "Securities Module not enabled for this trust" }, { status: 403 });
  }

  const id = crypto.randomUUID();
  await db.insert(securityHolders).values({
    id,
    trustId,
    displayName: body.displayName.trim(),
    holderRef: body.holderRef ? body.holderRef.trim() : null,
  } as any);

  const row = (await db.select().from(securityHolders).where(eq(securityHolders.id, id)).limit(1))[0];
  return NextResponse.json({
    holder: {
      id: String(row.id),
      displayName: String((row as any).displayName),
      holderRef: (row as any).holderRef ? String((row as any).holderRef) : null,
      createdAt: (row as any).createdAt ? new Date((row as any).createdAt as any).toISOString() : null,
    },
  });
}




