/**
 * Trust Records Collateral Pool Assets API
 * POST: Add asset to pool
 * DELETE: Remove asset from pool (via query ?assetId=...)
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  trusts,
  trustCollateralPools,
  trustCollateralPoolAssets,
} from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ poolId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { poolId } = await ctx.params;
  if (!poolId) return NextResponse.json({ error: "Invalid poolId" }, { status: 400 });

  let body: { assetId: string; allocatedValue?: number; lienPosition?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { assetId } = body;
  if (!assetId?.trim()) return NextResponse.json({ error: "assetId is required" }, { status: 400 });

  const db = await getDb();
  const [pool] = await db
    .select()
    .from(trustCollateralPools)
    .where(eq(trustCollateralPools.id, poolId))
    .limit(1);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, pool.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const id = uuidv4();
  await db.insert(trustCollateralPoolAssets).values({
    id,
    poolId,
    assetId: assetId.trim(),
    allocatedValue: body.allocatedValue != null ? String(body.allocatedValue) : null,
    lienPosition: body.lienPosition ?? null,
    notes: body.notes ?? null,
  });

  const [created] = await db
    .select()
    .from(trustCollateralPoolAssets)
    .where(eq(trustCollateralPoolAssets.id, id))
    .limit(1);

  return NextResponse.json(
    {
      ok: true,
      asset: {
        id: created.id,
        poolId: created.poolId,
        assetId: created.assetId,
        allocatedValue: created.allocatedValue ? Number(created.allocatedValue) : null,
        lienPosition: created.lienPosition,
        notes: created.notes,
        createdAt: created.createdAt?.toISOString(),
      },
    },
    { status: 201 }
  );
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ poolId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { poolId } = await ctx.params;
  const assetId = new URL(req.url).searchParams.get("assetId");
  if (!poolId || !assetId) {
    return NextResponse.json({ error: "poolId and assetId are required" }, { status: 400 });
  }

  const db = await getDb();
  const [pool] = await db
    .select()
    .from(trustCollateralPools)
    .where(eq(trustCollateralPools.id, poolId))
    .limit(1);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, pool.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const existing = await db
    .select()
    .from(trustCollateralPoolAssets)
    .where(
      and(
        eq(trustCollateralPoolAssets.poolId, poolId),
        eq(trustCollateralPoolAssets.assetId, assetId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Asset not in pool" }, { status: 404 });
  }

  await db
    .delete(trustCollateralPoolAssets)
    .where(eq(trustCollateralPoolAssets.id, existing[0].id));

  return NextResponse.json({ ok: true, removed: true });
}
