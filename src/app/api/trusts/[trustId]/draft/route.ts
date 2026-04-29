import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trustDrafts, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

const BodySchema = z.object({
  draftType: z.string().min(1).max(80),
  schemaVersion: z.number().int().min(1).max(1000),
  payload: z.unknown(),
});

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

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const draftId = crypto.randomUUID();
  const createdAtIso = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ maxV: sql<number>`max(${trustDrafts.version})` })
      .from(trustDrafts)
      .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, body.draftType)))
      .limit(1);
    const nextVersion = Number(maxRows[0]?.maxV ?? 0) + 1;

    await tx.insert(trustDrafts).values({
      id: draftId,
      trustId,
      draftType: body.draftType,
      schemaVersion: body.schemaVersion,
      version: nextVersion,
      payloadJson: JSON.stringify(body.payload ?? null),
    } as any);

    // Touch parent row to keep updatedAt in sync.
    await tx.update(trusts).set({ source: trustRows[0]?.source ?? null } as any).where(eq(trusts.id, trustId));

    return { nextVersion };
  });

  return NextResponse.json({
    trustId,
    draftId,
    version: result.nextVersion,
    createdAt: createdAtIso,
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  const url = new URL(request.url);
  const draftType = (url.searchParams.get("draftType") || "").trim();
  if (!draftType) return NextResponse.json({ error: "draftType query param is required" }, { status: 400 });

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, draftType)))
    .orderBy(sql`version desc`)
    .limit(1);

  if (rows.length === 0) return NextResponse.json({ trustId, draft: null });

  const r: any = rows[0];
  let payload: unknown = null;
  try {
    payload = JSON.parse(String(r.payloadJson ?? "null"));
  } catch {
    payload = null;
  }

  return NextResponse.json({
    trustId,
    draft: {
      id: String(r.id),
      trustId: String(r.trustId),
      draftType: String(r.draftType),
      schemaVersion: Number(r.schemaVersion ?? 1),
      version: Number(r.version ?? 1),
      payload,
      createdAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
    },
  });
}




