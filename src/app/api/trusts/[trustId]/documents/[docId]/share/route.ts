import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { accessLogs, documentDisclosures, trustDocuments, trusts } from "@/lib/db/schema";
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
  expiresAt: z.string().datetime().optional(),
  // optional conditions for public shares
  requireEmail: z.boolean().optional(),
  recipientEmail: z.string().email().optional(),
});

function randomShareToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ trustId: string; docId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId, docId } = await ctx.params;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Enforcement: only allow direct share for PUBLIC documents.
  const docRows = await db.select().from(trustDocuments).where(and(eq(trustDocuments.id, docId), eq(trustDocuments.trustId, trustId))).limit(1);
  if (docRows.length === 0) {
    // For now, if a doc isn't in trust_documents, we can't classify it here reliably. Require request workflow.
    return NextResponse.json({ error: "Document not found in trust_documents; use request workflow" }, { status: 404 });
  }
  const doc: any = docRows[0];
  if (doc.classification !== "public") {
    return NextResponse.json({ error: "Direct sharing is only allowed for Public documents" }, { status: 403 });
  }

  const disclosureId = crypto.randomUUID();
  const shareToken = randomShareToken();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  await db.insert(documentDisclosures).values({
    id: disclosureId,
    trustId,
    requestId: null,
    documentId: docId,
    shareToken,
    status: "active",
    conditionsJson: JSON.stringify({
      requireEmail: Boolean(body.requireEmail),
      recipientEmail: body.recipientEmail ?? null,
    }),
    expiresAt,
  } as any);

  await db.insert(accessLogs).values({
    id: crypto.randomUUID(),
    trustId,
    actorUserId: userId,
    action: "public_share_created",
    documentId: docId,
    disclosureId,
    metaJson: JSON.stringify({ expiresAt: body.expiresAt ?? null }),
  } as any);

  return NextResponse.json({ trustId, docId, disclosureId, shareToken, shareUrl: `/share/${shareToken}` });
}




