import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trustDrafts, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { insertAuditLog } from "@/lib/audit";

const DraftType = "smart-trust-references";
const SchemaVersion = 1;
const MaxBytes = 128 * 1024;

const ReferenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  topic: z.string().min(1),
  scope: z.string().min(1),
});

const AttachSchema = z.object({
  reference: ReferenceSchema,
});

const DetachSchema = z.object({
  referenceId: z.string().min(1),
});

function normalizeReference(ref: z.infer<typeof ReferenceSchema>) {
  return {
    id: ref.id,
    title: ref.title,
    topic: ref.topic,
    scope: ref.scope,
  };
}

async function loadAttachedReferences(db: Awaited<ReturnType<typeof getDb>>, trustId: string) {
  const rows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, DraftType)))
    .orderBy(sql`version desc`)
    .limit(1);

  if (rows.length === 0) return { attachedReferences: [], version: 0 };

  const r: any = rows[0];
  let payload: any = null;
  try {
    payload = JSON.parse(String(r.payloadJson ?? "null"));
  } catch {
    payload = null;
  }

  const attachedReferences = Array.isArray(payload?.attachedReferences) ? payload.attachedReferences : [];
  return { attachedReferences, version: Number(r.version ?? 0) };
}

async function saveAttachedReferences(
  trustId: string,
  userId: number,
  attachedReferences: unknown[],
  trustSource: string | null
) {
  const encoded = JSON.stringify({
    attachedReferences,
    schemaVersion: SchemaVersion,
  });
  const bytes = Buffer.byteLength(encoded, "utf8");
  if (bytes > MaxBytes) throw new Error("Payload too large");

  const db = await getDb();
  const draftId = crypto.randomUUID();
  const createdAtIso = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ maxV: sql<number>`max(${trustDrafts.version})` })
      .from(trustDrafts)
      .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, DraftType)))
      .limit(1);
    const nextVersion = Number(maxRows[0]?.maxV ?? 0) + 1;

    await tx.insert(trustDrafts).values({
      id: draftId,
      trustId,
      draftType: DraftType,
      schemaVersion: SchemaVersion,
      version: nextVersion,
      payloadJson: encoded,
    } as any);

    await tx.update(trusts).set({ source: trustSource } as any).where(eq(trusts.id, trustId));

    await insertAuditLog(tx as any, {
      actorUserId: userId,
      action: "smart_trust_references_updated",
      entityType: "trust",
      entityId: trustId,
      metadata: { draftId, version: nextVersion, bytes },
    });

    return { nextVersion };
  });

  return { createdAtIso, version: result.nextVersion };
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const { attachedReferences, version } = await loadAttachedReferences(db, trustId);

  return NextResponse.json({ trustId, attachedReferences, version });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof AttachSchema>;
  try {
    body = AttachSchema.parse(await request.json());
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

  const existing = await loadAttachedReferences(db, trustId);
  const current = Array.isArray(existing.attachedReferences) ? existing.attachedReferences : [];
  const next = [
    ...current.filter((x: any) => x?.id !== body.reference.id),
    { ...normalizeReference(body.reference), addedAt: new Date().toISOString() },
  ];

  const saved = await saveAttachedReferences(trustId, userId, next, trustRows[0]?.source ?? null);

  return NextResponse.json({
    trustId,
    attachedReferences: next,
    version: saved.version,
    updatedAt: saved.createdAtIso,
  });
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof DetachSchema>;
  try {
    body = DetachSchema.parse(await request.json());
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

  const existing = await loadAttachedReferences(db, trustId);
  const current = Array.isArray(existing.attachedReferences) ? existing.attachedReferences : [];
  const next = current.filter((x: any) => x?.id !== body.referenceId);

  const saved = await saveAttachedReferences(trustId, userId, next, trustRows[0]?.source ?? null);

  return NextResponse.json({
    trustId,
    attachedReferences: next,
    version: saved.version,
    updatedAt: saved.createdAtIso,
  });
}
