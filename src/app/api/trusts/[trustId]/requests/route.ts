import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { accessLogs, documentRequests, trustDocuments, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateRequestSchema = z.object({
  requestorRole: z.enum(["bank", "auditor", "regulator", "court", "counterparty", "other"]),
  requestorEmail: z.string().email().optional(),
  purpose: z.string().min(3).max(2000),
  requestedDocumentIds: z.array(z.string().min(1)).min(1).max(50),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(documentRequests)
    .where(eq(documentRequests.trustId, trustId))
    .orderBy(sql`createdAt desc`)
    .limit(200);

  return NextResponse.json({
    trustId,
    items: rows.map((r: any) => ({
      id: String(r.id),
      trustId: String(r.trustId),
      requestorRole: String(r.requestorRole),
      requestorEmail: r.requestorEmail ?? null,
      purpose: String(r.purpose),
      requestedDocumentIds: JSON.parse(String(r.requestedDocumentIdsJson || "[]")),
      status: r.status,
      expiresAt: r.expiresAt ? new Date(r.expiresAt as any).toISOString() : null,
      createdAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
      updatedAt: r.updatedAt ? new Date(r.updatedAt as any).toISOString() : null,
    })),
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

  let body: z.infer<typeof CreateRequestSchema>;
  try {
    body = CreateRequestSchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Enforcement: requested documents must exist and be demandable (private/public cannot be requested via demandable workflow).
  // NOTE: Legacy derived docs (not in trust_documents) are not supported by this endpoint anymore.
  const docs = await db
    .select()
    .from(trustDocuments)
    .where(and(eq(trustDocuments.trustId, trustId), sql`id in (${sql.join(body.requestedDocumentIds.map((id) => sql`${id}`), sql`,`)})`))
    .limit(50);
  const foundIds = new Set(docs.map((d: any) => String(d.id)));
  for (const id of body.requestedDocumentIds) {
    if (!foundIds.has(id)) return NextResponse.json({ error: `Unknown documentId: ${id}` }, { status: 400 });
  }
  const bad = docs.find((d: any) => d.classification !== "demandable");
  if (bad) return NextResponse.json({ error: "Only Demandable documents can be requested via workflow" }, { status: 400 });

  const requestId = crypto.randomUUID();
  await db.insert(documentRequests).values({
    id: requestId,
    trustId,
    requestorRole: body.requestorRole,
    requestorEmail: body.requestorEmail ?? null,
    purpose: body.purpose,
    requestedDocumentIdsJson: JSON.stringify(body.requestedDocumentIds),
    status: "pending",
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
  } as any);

  await db.insert(accessLogs).values({
    id: crypto.randomUUID(),
    trustId,
    actorUserId: userId,
    action: "demandable_request_created",
    metaJson: JSON.stringify({ requestId, requestorRole: body.requestorRole }),
  } as any);

  return NextResponse.json({ trustId, requestId, status: "pending" });
}


