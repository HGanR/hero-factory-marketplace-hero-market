import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trustControls, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

const BodySchema = z
  .object({
    source: z.enum(["trust-records", "wizard", "besu"]).optional(),
  })
  .optional();

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema> = undefined;
  try {
    // Body is optional; allow empty POSTs.
    const text = await request.text();
    body = text ? BodySchema.parse(JSON.parse(text)) : undefined;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const trustId = crypto.randomUUID();
  const db = await getDb();

  await db.transaction(async (tx) => {
    await tx.insert(trusts).values({
      id: trustId,
      userId,
      status: "draft",
      source: body?.source ?? null,
    } as any);

    // Always create a trust_controls row so feature flags are trust-scoped and not dependent on globals.
    await tx.insert(trustControls).values({
      id: crypto.randomUUID(),
      trustId,
      securitiesEnabled: false,
      requireCounselApproval: true,
      requireTrusteeApproval: true,
    } as any);
  });

  const rows = await db.select().from(trusts).where(eq(trusts.id, trustId)).limit(1);
  const row = rows[0];

  return NextResponse.json({
    trustId,
    status: row?.status ?? "draft",
    createdAt: row?.createdAt ? new Date(row.createdAt as any).toISOString() : new Date().toISOString(),
    updatedAt: row?.updatedAt ? new Date(row.updatedAt as any).toISOString() : new Date().toISOString(),
  });
}


