import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

import { getDb } from "@/lib/db";
import { workflowTrustAssets, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateAssetSchema = z.object({
  type: z.enum(["Cash", "Real Estate", "Security", "Promissory Note", "Digital Asset", "Intellectual Property", "Other"]),
  name: z.string().min(1).max(255),
  identifier: z.string().optional(),
  valuationUSD: z.number().int().min(0).optional(),
  valuationAsOf: z.string().optional(),
  encumbrances: z.string().optional(),
  evidenceNotes: z.string().optional(),
});

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Get assets for this trust
  const assets = await db
    .select()
    .from(workflowTrustAssets)
    .where(eq(workflowTrustAssets.trustId, trustId))
    .orderBy(desc(workflowTrustAssets.createdAt));

  return NextResponse.json({
    trustId,
    assets: assets.map(asset => ({
      id: asset.id,
      trustId: asset.trustId,
      type: asset.type,
      name: asset.name,
      identifier: asset.identifier,
      valuationUSD: asset.valuationUSD,
      valuationAsOf: asset.valuationAsOf,
      encumbrances: asset.encumbrances,
      evidenceNotes: asset.evidenceNotes,
      status: asset.status,
      createdAt: asset.createdAt?.toISOString(),
      updatedAt: asset.updatedAt?.toISOString(),
    }))
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof CreateAssetSchema>;
  try {
    body = CreateAssetSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Create asset
  const assetId = crypto.randomUUID();

  const result = await db.insert(workflowTrustAssets).values({
    id: assetId,
    trustId,
    type: body.type,
    name: body.name,
    identifier: body.identifier,
    valuationUSD: body.valuationUSD,
    valuationAsOf: body.valuationAsOf,
    encumbrances: body.encumbrances,
    evidenceNotes: body.evidenceNotes,
    status: "recorded",
  });

  return NextResponse.json({
    asset: {
      id: assetId,
      trustId,
      type: body.type,
      name: body.name,
      identifier: body.identifier,
      valuationUSD: body.valuationUSD,
      valuationAsOf: body.valuationAsOf,
      encumbrances: body.encumbrances,
      evidenceNotes: body.evidenceNotes,
      status: "recorded",
      createdAt: new Date().toISOString(),
    }
  }, { status: 201 });
}
