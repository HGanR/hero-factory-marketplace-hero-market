import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trustDrafts, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { insertAuditLog } from "@/lib/audit";

const BodySchema = z.object({
  draft: z.unknown(),
  schemaVersion: z.number().int().min(1).max(1000).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

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
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const draftType = "smart-trust-draft";
  const schemaVersion = Math.max(1, Number(body.schemaVersion ?? 1));

  const encoded = JSON.stringify({
    draft: body.draft ?? null,
    schemaVersion,
    meta: body.meta ?? null,
  });

  // Cap payload size to reduce abuse risk. (MVP: 768 KB; smart-trust drafts can be larger than ecclesiastical)
  const bytes = Buffer.byteLength(encoded, "utf8");
  if (bytes > 768 * 1024) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const draftId = crypto.randomUUID();
  const createdAtIso = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ maxV: sql<number>`max(${trustDrafts.version})` })
      .from(trustDrafts)
      .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, draftType)))
      .limit(1);
    const nextVersion = Number(maxRows[0]?.maxV ?? 0) + 1;

    await tx.insert(trustDrafts).values({
      id: draftId,
      trustId,
      draftType,
      schemaVersion,
      version: nextVersion,
      payloadJson: encoded,
    } as any);

    await insertAuditLog(tx as any, {
      actorUserId: userId,
      action: "smart_trust_draft_saved",
      entityType: "trust",
      entityId: trustId,
      metadata: { draftId, version: nextVersion, schemaVersion, bytes },
    });

    // Touch parent row to keep updatedAt fresh.
    await tx.update(trusts).set({ source: trustRows[0]?.source ?? null } as any).where(eq(trusts.id, trustId));

    return { nextVersion };
  });

  return NextResponse.json({
    trustId,
    draftId,
    status: "saved",
    version: result.nextVersion,
    createdAt: createdAtIso,
  });
}


