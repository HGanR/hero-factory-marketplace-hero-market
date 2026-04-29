import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { accessLogs, documentDisclosures, documentRequests, trustDocuments, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const BodySchema = z.object({
  decision: z.enum(["approve", "deny", "more_info"]),
  // Optional override expiry for approved disclosures
  expiresAt: z.string().datetime().optional(),
});

function randomShareToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ trustId: string; requestId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, requestId } = await ctx.params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const reqRows = await db.select().from(documentRequests).where(and(eq(documentRequests.id, requestId), eq(documentRequests.trustId, trustId))).limit(1);
  if (reqRows.length === 0) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  const r: any = reqRows[0];
  if (String(r.status) !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be decided" }, { status: 409 });
  }
  const requestedIds: string[] = (() => {
    try {
      const parsed = JSON.parse(String(r.requestedDocumentIdsJson || "[]"));
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  })();

  if (body.decision !== "approve") {
    await db.update(documentRequests).set({ status: body.decision === "deny" ? "denied" : "more_info" } as any).where(eq(documentRequests.id, requestId));
    await db.insert(accessLogs).values({
      id: crypto.randomUUID(),
      trustId,
      actorUserId: userId,
      action: body.decision === "deny" ? "demandable_request_denied" : "demandable_request_more_info",
      metaJson: JSON.stringify({ requestId }),
    } as any);
    return NextResponse.json({ trustId, requestId, status: body.decision === "deny" ? "denied" : "more_info" });
  }

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : r.expiresAt ? new Date(r.expiresAt) : null;

  // Enforcement: only allow disclosures for documents classified as demandable.
  const docs = await db.select().from(trustDocuments).where(and(eq(trustDocuments.trustId, trustId), sql`id in (${sql.join(requestedIds.map((id) => sql`${id}`), sql`,`)})`)).limit(50);
  const foundIds = new Set(docs.map((d: any) => String(d.id)));
  for (const id of requestedIds) {
    if (!foundIds.has(id)) return NextResponse.json({ error: `Unknown documentId: ${id}` }, { status: 400 });
  }
  const bad = docs.find((d: any) => d.classification !== "demandable");
  if (bad) return NextResponse.json({ error: "Private/Public documents cannot be disclosed via demandable workflow" }, { status: 403 });

  // Approve: mint disclosures for each requested document id (last-write-wins).
  const disclosures: { documentId: string; shareToken: string; disclosureId: string }[] = [];
  for (const docId of requestedIds) {
    const disclosureId = crypto.randomUUID();
    const token = randomShareToken();
    await db.insert(documentDisclosures).values({
      id: disclosureId,
      trustId,
      requestId,
      documentId: docId,
      shareToken: token,
      status: "active",
      conditionsJson: JSON.stringify({
        requestorRole: r.requestorRole,
        requestorEmail: r.requestorEmail ?? null,
        purpose: r.purpose,
      }),
      expiresAt,
    } as any);
    disclosures.push({ documentId: docId, shareToken: token, disclosureId });
  }

  await db.update(documentRequests).set({ status: "approved" } as any).where(eq(documentRequests.id, requestId));

  await db.insert(accessLogs).values({
    id: crypto.randomUUID(),
    trustId,
    actorUserId: userId,
    action: "demandable_request_approved",
    metaJson: JSON.stringify({ requestId, disclosureCount: disclosures.length }),
  } as any);

  return NextResponse.json({ trustId, requestId, status: "approved", disclosures });
}


