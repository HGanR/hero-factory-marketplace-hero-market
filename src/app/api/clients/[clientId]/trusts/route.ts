import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { clients, trustControls, trustDrafts, trustParties, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { insertAuditLog } from "@/lib/audit";
import { getDefaultClauseSet, type TrustType } from "@/config/trustDefaults";

const BodySchema = z.object({
  trust_type: z.enum([
    "revocable_living_trust",
    "irrevocable_trust",
    "testamentary_trust",
    "special_purpose_trust",
  ]),
  jurisdiction_state: z.string().min(2),
  name: z.string().min(3),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await ctx.params;
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const owned = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, String(clientId)), eq(clients.userId, userId)))
    .limit(1);
  if (owned.length === 0) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const client: any = owned[0];

  const trustId = crypto.randomUUID();
  const trustType = body.trust_type as TrustType;
  const jurisdictionState = String(body.jurisdiction_state).toUpperCase();
  const defaultClauses = getDefaultClauseSet({ trustType, jurisdictionState });

  await db.transaction(async (tx) => {
    await tx.insert(trusts).values({
      id: trustId,
      userId,
      status: "draft",
      source: "wizard",

      clientId: String(clientId),
      name: body.name,
      trustType,
      jurisdictionState,
      governingLawState: jurisdictionState,
      workspaceStatus: "draft",
    } as any);

    await tx.insert(trustControls).values({
      id: crypto.randomUUID(),
      trustId,
      securitiesEnabled: false,
      requireCounselApproval: true,
      requireTrusteeApproval: true,
    } as any);

    // Initialize clause set draft (MVP: stored as a trust_drafts payload)
    await tx.insert(trustDrafts).values({
      id: crypto.randomUUID(),
      trustId,
      draftType: "default-clause-set",
      schemaVersion: 1,
      version: 1,
      payloadJson: JSON.stringify({
        trust_type: trustType,
        jurisdiction_state: jurisdictionState,
        clauses: defaultClauses,
      }),
    } as any);

    // Initialize trust sub-resources (empty tables, with placeholders)
    const clientFullName = [client.firstName, client.middleName, client.lastName, client.suffix]
      .filter(Boolean)
      .join(" ");

    await tx.insert(trustParties).values([
      { id: crypto.randomUUID(), trustId, role: "grantor", displayName: clientFullName || null } as any,
      { id: crypto.randomUUID(), trustId, role: "trustee", displayName: null } as any,
    ]);

    await insertAuditLog(tx as any, {
      actorUserId: userId,
      action: "trust_created",
      entityType: "trust",
      entityId: trustId,
      metadata: { trust_type: trustType, jurisdiction: jurisdictionState, clientId: String(clientId) },
    });
  });

  return NextResponse.json({ trustId, status: "draft" });
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await ctx.params;
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  const db = await getDb();
  const rows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.userId, userId), eq(trusts.clientId, String(clientId))))
    .orderBy(desc(trusts.createdAt));

  return NextResponse.json({
    items: rows.map((t: any) => ({
      id: String(t.id),
      name: t.name ?? null,
      trustType: t.trustType ?? null,
      jurisdictionState: t.jurisdictionState ?? null,
      workspaceStatus: t.workspaceStatus ?? null,
      createdAt: t.createdAt ? new Date(t.createdAt as any).toISOString() : null,
    })),
  });
}



